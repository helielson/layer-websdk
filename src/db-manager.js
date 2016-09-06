/**
 * Persistence manager.
 *
 * This class manages all indexedDB access.  It is not responsible for any localStorage access, though it may
 * receive configurations related to data stored in localStorage.  It will simply ignore those configurations.
 *
 * Rich Content will be written to IndexedDB as long as its small; see layer.DbManager.MaxPartSize for more info.
 *
 * TODO:
 * 0. Redesign this so that knowledge of the data is not hard-coded in
 * @class layer.DbManager
 * @protected
 */

const Root = require('./root');
const logger = require('./logger');
const SyncEvent = require('./sync-event');
const Constants = require('./const');
const Util = require('./client-utils');

const DB_VERSION = 18;
const MAX_SAFE_INTEGER = 9007199254740991;
const SYNC_NEW = Constants.SYNC_STATE.NEW;

function getDate(inDate) {
  return inDate ? inDate.toISOString() : null;
}

const TABLES = [
  {
    name: 'conversations',
    indexes: {
      created_at: ['created_at'],
      last_message_sent: ['last_message_sent']
    },
  },
  {
    name: 'messages',
    indexes: {
      conversation: ['conversation', 'position']
    },
  },
  {
    name: 'syncQueue',
    indexes: {},
  },
];

class DbManager extends Root {

  /**
   * Create the DB Manager
   *
   * Key configuration is the layer.DbManager.persistenceFeatures property.
   *
   * @method constructor
   * @param {Object} options
   * @param {layer.Client} options.client
   * @param {Object} options.persistenceFeatures
   * @return {layer.DbManager} this
   */
  constructor(options) {
    super(options);

    // If no indexedDB, treat everything as disabled.
    if (!window.indexedDB) {
      options.tables = {};
    }

    // If Client is a layer.ClientAuthenticator, it won't support these events; this affects Unit Tests
    else if (this.client.constructor._supportedEvents.indexOf('conversations:add') !== -1) {
      this.client.on('conversations:add', evt => this.writeConversations(evt.conversations, false));
      this.client.on('conversations:change', evt => this.writeConversations([evt.target], true));
      this.client.on('conversations:delete', evt => this.deleteObjects('conversations', [evt.target]));

      this.client.on('messages:add', evt => this.writeMessages(evt.messages, false));
      this.client.on('messages:change', evt => this.writeMessages([evt.target], true));
      this.client.on('messages:delete', evt => this.deleteObjects('messages', [evt.target]));
    }

    this.client.syncManager.on('sync:add', evt => this.writeSyncEvents([evt.request], false));
    this.client.syncManager.on('sync:abort sync:error', evt => this.deleteObjects('syncQueue', [evt.request]));

    // Sync Queue only really works properly if we have the Messages and Conversations written to the DB; turn it off
    // if that won't be the case.
    if (!options.tables.conversations || !options.tables.messages) {
      options.tables.syncQueue = false;
    }

    TABLES.forEach((tableDef) => {
      this['_permission_' + tableDef.name] = Boolean(options.tables[tableDef.name]);
    });
    this._open();
  }


  /**
   * Open the Database Connection.
   *
   * This is only called by the constructor.
   * @method _open
   * @private
   */
  _open() {
    // Abort if all tables are disabled
    const enabledTables = TABLES.filter(tableDef => this['_permission_' + tableDef.name]);
    if (enabledTables.length === 0) {
      this._isOpenError = true;
      this.trigger('error', { error: 'Persistence is disabled by application' });
      return;
    }

    // Open the database
    const client = this.client;
    const request = window.indexedDB.open('LayerWebSDK_' + client.appId + '_' + client.user.userId, DB_VERSION);

    try {
      request.onerror = (evt) => {
        this._isOpenError = true;
        logger.error('Database Unable to Open: ', evt.target.error);
        this.trigger('error', { error: evt });
      };

      request.onupgradeneeded = (evt) => this._onUpgradeNeeded(evt);
      request.onsuccess = (evt) => {
        this.db = evt.target.result;
        this.isOpen = true;
        this.trigger('open');

        this.db.onversionchange = () => {
          this.db.close();
          this.isOpen = false;
        };

        this.db.error = err => {
          logger.error('db-manager Error: ', err);
        };
      };
    }

    /* istanbul ignore next */
    catch(err) {
      // Safari Private Browsing window will fail on request.onerror
      this._isOpenError = true;
      logger.error('Database Unable to Open: ', err);
      this.trigger('error', { error: err });
    }
  }

  /**
   * Use this to setup a call to happen as soon as the database is open.
   *
   * Typically, this call will immediately, synchronously call your callback.
   * But if the DB is not open yet, your callback will be called once its open.
   * @method onOpen
   * @param {Function} callback
   */
  onOpen(callback) {
    if (this.isOpen || this._isOpenError) callback();
    else this.once('open error', callback);
  }

  /**
   * The onUpgradeNeeded function is called by IndexedDB any time DB_VERSION is incremented.
   *
   * This invocation is part of the built-in lifecycle of IndexedDB.
   *
   * @method _onUpgradeNeeded
   * @param {IDBVersionChangeEvent} event
   * @private
   */
  /* istanbul ignore next */
  _onUpgradeNeeded(event) {
    const db = event.target.result;

    let completeCount = 0;
    function onComplete() {
      completeCount++;
      if (completeCount === TABLES.length) {
        this.isOpen = true;
        this.trigger('open');
      }
    }

    TABLES.forEach((tableDef) => {
      try {
        db.deleteObjectStore(tableDef.name);
      } catch (e) {
        // Noop
      }
      try {
        const store = db.createObjectStore(tableDef.name, { keyPath: 'id' });
        Object.keys(tableDef.indexes)
          .forEach(indexName => store.createIndex(indexName, tableDef.indexes[indexName], { unique: false }));
        store.transaction.oncomplete = onComplete;
      } catch (e) {
        // Noop
        logger.error(`Failed to create object store ${tableDef.name}`, e);
      }
    });
  }

  /**
   * Convert array of Conversation instances into Conversation DB Entries.
   *
   * A Conversation DB entry looks a lot like the server representation, but
   * includes a sync_state property, and `last_message` contains a message ID not
   * a Message object.
   *
   * @method _getConversationData
   * @private
   * @param {layer.Conversation[]} conversations
   * @return {Object[]} conversations
   */
  _getConversationData(conversations) {
    return conversations.filter(conversation => {
      if (conversation._fromDB) {
        conversation._fromDB = false;
        return false;
      } else if (conversation.isLoading || conversation.syncState === SYNC_NEW) {
        return false;
      } else {
        return true;
      }
    }).map(conversation => {
      const item = {
        id: conversation.id,
        url: conversation.url,
        participants: conversation.participants,
        distinct: conversation.distinct,
        created_at: getDate(conversation.createdAt),
        metadata: conversation.metadata,
        unread_message_count: conversation.unreadCount,
        last_message: conversation.lastMessage ? conversation.lastMessage.id : '',
        last_message_sent: conversation.lastMessage ? getDate(conversation.lastMessage.sentAt) : getDate(conversation.createdAt),
        sync_state: conversation.syncState,
      };
      return item;
    });
  }

  /**
   * Writes an array of Conversations to the Database.
   *
   * There are times when you will not know if this is an Insert or Update operation;
   * if there is uncertainy, set `isUpdate` to false, and the correct end result will
   * still be achieved (but less efficiently).
   *
   * @method writeConversations
   * @param {layer.Conversation[]} conversations - Array of Conversations to write
   * @param {boolean} isUpdate - If true, then update an entry; if false, insert an entry... and if one is found to already exist, update it.
   * @param {Function} [callback]
   */
  writeConversations(conversations, isUpdate, callback) {
    this._writeObjects('conversations',
      this._getConversationData(conversations.filter(conversation => !conversation.isDestroyed)), isUpdate, callback);
  }


  /**
   * Convert array of Message instances into Message DB Entries.
   *
   * A Message DB entry looks a lot like the server representation, but
   * includes a sync_state property.
   *
   * @method _getMessageData
   * @private
   * @param {layer.Message[]} messages
   * @param {Function} callback
   * @return {Object[]} messages
   */
  _getMessageData(messages, callback) {
    const dbMessages = messages.filter(message => {
      if (message._fromDB) {
        message._fromDB = false;
        return false;
      } else if (message.syncState === Constants.SYNC_STATE.LOADING) {
        return false;
      } else {
        return true;
      }
    }).map(message => ({
      id: message.id,
      url: message.url,
      parts: message.parts.map(part => {
        const body = Util.isBlob(part.body) && part.body.size > DbManager.MaxPartSize ? null : part.body;
        return {
          body,
          id: part.id,
          encoding: part.encoding,
          mime_type: part.mimeType,
          content: !part._content ? null : {
            id: part._content.id,
            download_url: part._content.downloadUrl,
            expiration: part._content.expiration,
            refresh_url: part._content.refreshUrl,
            size: part._content.size,
          },
        };
      }),
      position: message.position,
      sender: {
        name: message.sender.name,
        user_id: message.sender.userId,
        display_name: message.sender.displayName,
        avatar_url: message.sender.avatarUrl,
      },
      recipient_status: message.recipientStatus,
      sent_at: getDate(message.sentAt),
      received_at: getDate(message.receivedAt),
      conversation: message.constructor.prefixUUID === 'layer:///announcements/' ? 'announcement' : message.conversationId,
      sync_state: message.syncState,
      is_unread: message.isUnread,
    }));

    // Find all blobs and convert them to base64... because Safari 9.1 doesn't support writing blobs those Frelling Smurfs.
    let count = 0;
    const parts = [];
    dbMessages.forEach((message) => {
      message.parts.forEach((part) => {
        if (Util.isBlob(part.body)) parts.push(part);
      });
    });
    if (parts.length === 0) {
      callback(dbMessages);
    } else {
      parts.forEach((part) => {
        Util.blobToBase64(part.body, (base64) => {
          part.body = base64;
          part.useBlob = true;
          count++;
          if (count === parts.length) callback(dbMessages);
        });
      });
    }
  }

  /**
   * Writes an array of Messages to the Database.
   *
   * There are times when you will not know if this is an Insert or Update operation;
   * if there is uncertainy, set `isUpdate` to false, and the correct end result will
   * still be achieved (but less efficiently).
   *
   * @method writeMessages
   * @param {layer.Message[]} messages - Array of Messages to write
   * @param {boolean} isUpdate - If true, then update an entry; if false, insert an entry... and if one is found to already exist, update it.
   * @param {Function} [callback]
   */
  writeMessages(messages, isUpdate, callback) {
    this._getMessageData(
      messages.filter(message => !message.isDestroyed),
      dbMessageData => this._writeObjects('messages', dbMessageData, isUpdate, callback)
    );
  }

  /**
   * Convert array of SyncEvent instances into SyncEvent DB Entries.
   *
   * @method _getSyncEventData
   * @param {layer.SyncEvent[]} syncEvents
   * @return {Object[]} syncEvents
   * @private
   */
  _getSyncEventData(syncEvents) {
    return syncEvents.filter(syncEvt => {
      if (syncEvt.fromDB) {
        syncEvt.fromDB = false;
        return false;
      } else {
        return true;
      }
    }).map(syncEvent => {
      const item = {
        id: syncEvent.id,
        target: syncEvent.target,
        depends: syncEvent.depends,
        isWebsocket: syncEvent instanceof SyncEvent.WebsocketSyncEvent,
        operation: syncEvent.operation,
        data: syncEvent.data,
        url: syncEvent.url || '',
        headers: syncEvent.headers || null,
        method: syncEvent.method || null,
        created_at: syncEvent.createdAt,
      };
      return item;
    });
  }

  /**
   * Writes an array of SyncEvent to the Database.
   *
   * @method writeSyncEvents
   * @param {layer.SyncEvent[]} syncEvents - Array of Sync Events to write
   * @param {boolean} isUpdate - If true, then update an entry; if false, insert an entry... and if one is found to already exist, update it.
   * @param {Function} [callback]
   */
  writeSyncEvents(syncEvents, isUpdate, callback) {
    this._writeObjects('syncQueue', this._getSyncEventData(syncEvents), isUpdate, callback);
  }


  /**
   * Write an array of data to the specified Database table.
   *
   * @method _writeObjects
   * @param {string} tableName - The name of the table to write to
   * @param {Object[]} data - Array of POJO data to write
   * @param {Boolean} isUpdate - If true, then update an entry; if false, insert an entry... and if one is found to already exist, update it.
   * @param {Function} [callback] - Called when all data is written
   * @protected
   */
  _writeObjects(tableName, data, isUpdate, callback) {
    if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;

    // Just quit if no data to write
    if (!data.length) {
      if (callback) callback();
      return;
    }

    // transactionComplete will call the callback after all writes are done.
    // Note that the number of transactions is 1 + number of failed inserts
    let transactionCount = 1,
      transactionCompleteCount = 0;
    function transactionComplete() {
      transactionCompleteCount++;
      if (transactionCompleteCount === transactionCount && callback) callback();
    }

    // PUT (udpate) or ADD (insert) each item of data one at a time, but all as part of one large transaction.
    this.onOpen(() => {
      const transaction = this.db.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      transaction.oncomplete = transaction.onerror = transactionComplete;

      // If the request fails, and we were doing an insert, try an update instead.
      // This will create one transaction per error.
      // TODO: Investigate capturing all errors and then using a single transaction to update all failed items.
      const onError = function onError(item) {
        if (!isUpdate) {
          transactionCount++;
          const transaction2 = this.db.transaction([tableName], 'readwrite');
          const store2 = transaction2.objectStore(tableName);
          transaction2.oncomplete = transaction2.onerror = transactionComplete;
          store2.put(item);
        }
      }.bind(this);

      data.forEach(item => {
        try {
          const req = isUpdate ? store.put(item) : store.add(item);
          req.onerror = () => onError(item);
        } catch (e) {
          // Safari throws an error rather than use the onerror event.
          onError(item);
        }
      });
    });
  }

  /**
   * Load all conversations from the database.
   *
   * @method loadConversations
   * @param {string} sortBy       - One of 'last_message' or 'created_at'; always sorts in DESC order
   * @param {string} [fromId=]    - For pagination, provide the conversationId to get Conversations after
   * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
   * @param {Function} [callback]  - Callback for getting results
   * @param {layer.Conversation[]} callback.result
   */
  loadConversations(sortBy, fromId, pageSize, callback) {
    try {
      let sortIndex,
        range = null;
      const fromConversation = fromId ? this.client.getConversation(fromId) : null;
      if (sortBy === 'last_message') {
        sortIndex = 'last_message_sent';
        if (fromConversation) {
          range = window.IDBKeyRange.upperBound([fromConversation.lastMessage ?
            getDate(fromConversation.lastMessage.sentAt) : getDate(fromConversation.createdAt)]);
        }
      } else {
        sortIndex = 'created_at';
        if (fromConversation) {
          range = window.IDBKeyRange.upperBound([getDate(fromConversation.createdAt)]);
        }
      }

      // Step 1: Get all Conversations
      this._loadByIndex('conversations', sortIndex, range, Boolean(fromId), pageSize, (data) => {
        // Step 2: Gather all Message IDs needed to initialize these Conversation's lastMessage properties.
        const messagesToLoad = data
          .map(item => item.last_message)
          .filter(messageId => messageId && !this.client.getMessage(messageId));

        // Step 3: Load all Messages needed to initialize these Conversation's lastMessage properties.
        this.getObjects('messages', messagesToLoad, (messages) => {
          this._loadConversationsResult(data, messages, callback);
        });
      });
    } catch (e) {
      // Noop -- handle browsers like IE that don't like these IDBKeyRanges
    }
  }

  /**
   * Assemble all LastMessages and Conversation POJOs into layer.Message and layer.Conversation instances.
   *
   * @method _loadConversationsResult
   * @private
   * @param {Object[]} conversations
   * @param {Object[]} messages
   * @param {Function} callback
   * @param {layer.Conversation[]} callback.result
   */
  _loadConversationsResult(conversations, messages, callback) {
    // Instantiate and Register each Message
    messages.forEach(message => this._createMessage(message));

    // Instantiate and Register each Conversation; will find any lastMessage that was registered.
    const newData = conversations
      .map(conversation => this._createConversation(conversation) || this.client.getConversation(conversation.id))
      .filter(conversation => conversation);

    // Return the data
    if (callback) callback(newData);
  }

  /**
   * Load all messages for a given Conversation ID from the database.
   *
   * Use _loadAll if loading All Messages rather than all Messages for a Conversation.
   *
   * @method loadMessages
   * @param {string} conversationId - ID of the Conversation whose Messages are of interest.
   * @param {string} [fromId=]    - For pagination, provide the messageId to get Messages after
   * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
   * @param {Function} [callback]   - Callback for getting results
   * @param {layer.Message[]} callback.result
   */
  loadMessages(conversationId, fromId, pageSize, callback) {
    try {
      const fromMessage = fromId ? this.client.getMessage(fromId) : null;
      const query = window.IDBKeyRange.bound([conversationId, 0],
        [conversationId, fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
      this._loadByIndex('messages', 'conversation', query, Boolean(fromId), pageSize, (data) => {
        this._loadMessagesResult(data, callback);
      });
    } catch (e) {
      // Noop -- handle browsers like IE that don't like these IDBKeyRanges
    }
  }

  /**
   * Load all Announcements from the database.
   *
   * @method loadAnnouncements
   * @param {string} [fromId=]    - For pagination, provide the messageId to get Announcements after
   * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
   * @param {Function} [callback]
   * @param {layer.Announcement[]} callback.result
   */
  loadAnnouncements(fromId, pageSize, callback) {
    try {
      const fromMessage = fromId ? this.client.getMessage(fromId) : null;
      const query = window.IDBKeyRange.bound(['announcement', 0],
        ['announcement', fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
      this._loadByIndex('messages', 'conversation', query, Boolean(fromId), pageSize, (data) => {
        this._loadMessagesResult(data, callback);
      });
    } catch (e) {
      // Noop -- handle browsers like IE that don't like these IDBKeyRanges
    }
  }

  _blobifyPart(part) {
    if (part.useBlob) {
      part.body = Util.base64ToBlob(part.body);
      delete part.useBlob;
      part.encoding = null;
    }
  }

  /**
   * Registers and sorts the message objects from the database.
   *
   * TODO: Encode limits on this, else we are sorting tens of thousands
   * of messages in javascript.
   *
   * @method _loadMessagesResult
   * @private
   * @param {Object[]} Message objects from the database.
   * @param {Function} callback
   * @param {layer.Message} callback.result - Message instances created from the database
   */
  _loadMessagesResult(messages, callback) {
    // Convert base64 to blob before sending it along...
    messages.forEach(message => message.parts.forEach(part => this._blobifyPart(part)));

    // Instantiate and Register each Message
    const newData = messages
      .map(message => this._createMessage(message) || this.client.getMessage(message.id))
      .filter(message => message);

    // Return the results
    if (callback) callback(newData);
  }

  /**
   * Instantiate and Register the Conversation from a conversation DB Entry.
   *
   * If the layer.Conversation already exists, then its presumed that whatever is in
   * javascript cache is more up to date than whats in IndexedDB cache.
   *
   * Attempts to assign the lastMessage property to refer to appropriate Message.  If it fails,
   * it will be set to null.
   *
   * @method _createConversation
   * @private
   * @param {Object} conversation
   * @returns {layer.Conversation}
   */
  _createConversation(conversation) {
    if (!this.client.getConversation(conversation.id)) {
      conversation._fromDB = true;
      const newConversation = this.client._createObject(conversation);
      newConversation.syncState = conversation.sync_state;
      return newConversation;
    }
  }

  /**
   * Instantiate and Register the Message from a message DB Entry.
   *
   * If the layer.Message already exists, then its presumed that whatever is in
   * javascript cache is more up to date than whats in IndexedDB cache.
   *
   * @method _createMessage
   * @private
   * @param {Object} message
   * @returns {layer.Message}
   */
  _createMessage(message) {
    if (!this.client.getMessage(message.id)) {
      message._fromDB = true;
      message.conversation = { id: message.conversation };
      const newMessage = this.client._createObject(message);
      newMessage.syncState = message.sync_state;
      return newMessage;
    }
  }

  /**
   * Load all Sync Events from the database.
   *
   * @method loadSyncQueue
   * @param {Function} callback
   * @param {layer.SyncEvent[]} callback.result
   */
  loadSyncQueue(callback) {
    this._loadAll('syncQueue', syncEvents => this._loadSyncEventRelatedData(syncEvents, callback));
  }

  /**
   * Validate that we have appropriate data for each SyncEvent and instantiate it.
   *
   * Any operation that is not a DELETE must have a valid target found in the database or javascript cache,
   * otherwise it can not be executed.
   *
   * TODO: Need to cleanup sync entries that have invalid targets
   *
   * @method _loadSyncEventRelatedData
   * @private
   * @param {Object[]} syncEvents
   * @param {Function} callback
   * @param {layer.SyncEvent[]} callback.result
   */
  _loadSyncEventRelatedData(syncEvents, callback) {
    // Gather all Message IDs that are targets of operations.
    const messageIds = syncEvents
      .filter(item => item.operation !== 'DELETE' && item.target && item.target.match(/messages/))
      .map(item => item.target);

    // Gather all Conversation IDs that are targets of operations.
    const conversationIds = syncEvents
      .filter(item => item.operation !== 'DELETE' && item.target && item.target.match(/conversations/))
      .map(item => item.target);

    // Load any Messages/Conversations that are targets of operations.
    // Call _createMessage or _createConversation on all targets found.
    let counter = 0;
    const maxCounter = 2;
    this.getObjects('messages', messageIds, (messages) => {
      messages.forEach(message => this._createMessage(message));
      counter++;
      if (counter === maxCounter) this._loadSyncEventResults(syncEvents, callback);
    });
    this.getObjects('conversations', conversationIds, (conversations) => {
      conversations.forEach(conversation => this._createConversation(conversation));
      counter++;
      if (counter === maxCounter) this._loadSyncEventResults(syncEvents, callback);
    });
  }

  /**
   * Turn an array of Sync Event DB Entries into an array of layer.SyncEvent.
   *
   * @method _loadSyncEventResults
   * @private
   * @param {Object[]} syncEvents
   * @param {Function} callback
   * @param {layer.SyncEvent[]} callback.result
   */
  _loadSyncEventResults(syncEvents, callback) {
    // If the target is present in the sync event, but does not exist in the system,
    // do NOT attempt to instantiate this event... unless its a DELETE operation.
    const newData = syncEvents
    .filter((syncEvent) => {
      const hasTarget = Boolean(syncEvent.target && this.client._getObject(syncEvent.target));
      return syncEvent.operation === 'DELETE' || hasTarget;
    })
    .map((syncEvent) => {
      if (syncEvent.isWebsocket) {
        return new SyncEvent.WebsocketSyncEvent({
          target: syncEvent.target,
          depends: syncEvent.depends,
          operation: syncEvent.operation,
          id: syncEvent.id,
          data: syncEvent.data,
          fromDB: true,
          createdAt: syncEvent.created_at,
        });
      } else {
        return new SyncEvent.XHRSyncEvent({
          target: syncEvent.target,
          depends: syncEvent.depends,
          operation: syncEvent.operation,
          id: syncEvent.id,
          data: syncEvent.data,
          method: syncEvent.method,
          headers: syncEvent.headers,
          url: syncEvent.url,
          fromDB: true,
          createdAt: syncEvent.created_at,
        });
      }
    });

    // Sort the results and then return them.
    // TODO: Query results should come back sorted by database with proper Index
    Util.sortBy(newData, item => item.createdAt);
    callback(newData);
  }

  /**
   * Load all data from the specified table.
   *
   * @method _loadAll
   * @protected
   * @param {String} tableName
   * @param {Function} callback
   * @param {Object[]} callback.result
   */
  _loadAll(tableName, callback) {
    if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
    this.onOpen(() => {
      const data = [];
      this.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor.continue();
        } else if (!this.isDestroyed) {
          callback(data);
        }
      };
    });
  }

  /**
   * Load all data from the specified table and with the specified index value.
   *
   * Results are always sorted in DESC order at this time.
   *
   * @method _loadByIndex
   * @protected
   * @param {String} tableName - 'messages', 'conversations'
   * @param {String} indexName - Name of the index to query on
   * @param {IDBKeyRange} range - Range to Query for (null ok)
   * @param {Boolean} isFromId - If querying for results after a specified ID, then we want to skip the first result (which will be that ID) ("" is ok)
   * @param {number} pageSize - If a value is provided, return at most that number of results; else return all results.
   * @param {Function} callback
   * @param {Object[]} callback.result
   */
  _loadByIndex(tableName, indexName, range, isFromId, pageSize, callback) {
    if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
    let shouldSkipNext = isFromId;
    this.onOpen(() => {
      const data = [];
      this.db.transaction([tableName], 'readonly')
          .objectStore(tableName)
          .index(indexName)
          .openCursor(range, 'prev')
          .onsuccess = (evt) => {
            const cursor = evt.target.result;
            if (cursor) {
              if (shouldSkipNext) {
                shouldSkipNext = false;
              } else {
                data.push(cursor.value);
              }
              if (pageSize && data.length >= pageSize) {
                callback(data);
              } else {
                cursor.continue();
              }
            } else if (!this.isDestroyed) {
              callback(data);
            }
          };
    });
  }

  /**
   * Deletes the specified objects from the specified table.
   *
   * Currently takes an array of data to delete rather than an array of IDs;
   * If you only have an ID, [{id: myId}] should work.
   *
   * @method deleteObjects
   * @param {String} tableName
   * @param {Object[]} data
   * @param {Function} [callback]
   */
  deleteObjects(tableName, data, callback) {
    if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;
    this.onOpen(() => {
      const transaction = this.db.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      transaction.oncomplete = callback;
      data.forEach(item => store.delete(item.id));
    });
  }

  /**
   * Retrieve the identified objects from the specified database table.
   *
   * Turning these into instances is the responsibility of the caller.
   *
   * Inspired by http://www.codeproject.com/Articles/744986/How-to-do-some-magic-with-indexedDB
   *
   * @method getObjects
   * @param {String} tableName
   * @param {String[]} ids
   * @param {Function} callback
   * @param {Object[]} callback.result
   */
  getObjects(tableName, ids, callback) {
    if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
    const data = [];

    // Gather, sort, and filter replica IDs
    const sortedIds = ids.sort();
    for (let i = sortedIds.length - 1; i > 0; i--) {
      if (sortedIds[i] === sortedIds[i - 1]) sortedIds.splice(i, 1);
    }
    let index = 0;

    // Iterate over the table searching for the specified IDs
    this.onOpen(() => {
      this.db.transaction([tableName], 'readonly')
        .objectStore(tableName)
        .openCursor().onsuccess = (evt) => {
          const cursor = evt.target.result;
          if (!cursor) {
            callback(data);
            return;
          }
          const key = cursor.key;

          // The cursor has passed beyond this key. Check next.
          while (key > sortedIds[index]) index++;

          // The cursor is pointing at one of our IDs, get it and check next.
          if (key === sortedIds[index]) {
            data.push(cursor.value);
            index++;
          }

          // Done or check next
          if (index === sortedIds.length) {
            if (!this.isDestroyed) callback(data);
          } else {
            cursor.continue(sortedIds[index]);
          }
        };
    });
  }

  /**
   * A simplified getObjects() method that gets a single object, and also gets its related objects.
   *
   * @method getObject
   * @param {string} tableName
   * @param {string} id
   * @param {Function} callback
   * @param {Object} callback.data
   */
  getObject(tableName, id, callback) {
    if (!this['_permission_' + tableName] || this._isOpenError) return callback();

    this.onOpen(() => {
      this.db.transaction([tableName], 'readonly')
        .objectStore(tableName)
        .openCursor(window.IDBKeyRange.only(id)).onsuccess = (evt) => {
          const cursor = evt.target.result;
          if (!cursor) return callback(null);

          switch (tableName) {
            case 'messages':
              cursor.value.conversation = {
                id: cursor.value.conversation,
              };
              // Convert base64 to blob before sending it along...
              cursor.value.parts.forEach(part => this._blobifyPart(part));
              return callback(cursor.value);
            case 'conversations':
              if (cursor.value.last_message && !this.client.getMessage(cursor.value.last_message)) {
                return this.getObject('messages', cursor.value.last_message, (message) => {
                  cursor.value.last_message = message;
                  callback(cursor.value);
                });
              } else {
                return callback(cursor.value);
              }
          }
        };
    });
  }

  /**
   * Claim a Sync Event.
   *
   * A sync event is claimed by locking the table,  validating that it is still in the table... and then deleting it from the table.
   *
   * @method claimSyncEvent
   * @param {layer.SyncEvent} syncEvent
   * @param {Function} callback
   * @param {Boolean} callback.result
   */
  claimSyncEvent(syncEvent, callback) {
    if (!this._permission_syncQueue || this._isOpenError) return callback(true);
    this.onOpen(() => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      store.get(syncEvent.id).onsuccess = evt => callback(Boolean(evt.target.result));
      store.delete(syncEvent.id);
    });
  }

  /**
   * Delete all data from all tables.
   *
   * This should be called from layer.Client.logout()
   *
   * @method deleteTables
   * @param {Function} [calllback]
   */
  deleteTables(callback) {
    this.onOpen(() => {
      if (!this.db) return callback();
      try {
        // Damned safari 9 throws errors on transactions across multiple tables.  So one at a time:
        let count = 0;
        const tableNames = TABLES.map(tableDef => tableDef.name);
        tableNames.forEach((name) => {
          const transaction = this.db.transaction([name], 'readwrite');
          transaction.objectStore(name).clear();
          transaction.oncomplete = () => {
            count++;
            if (count === tableNames.length) callback();
          };
        });
      } catch (e) {
        logger.error('Failed to delete table', e);
        callback(e);
      }
    });
  }
}

/**
 * @type {layer.Client} Layer Client instance
 */
DbManager.prototype.client = null;

/**
 * @type {boolean} is the db connection open
 */
DbManager.prototype.isOpen = false;

/**
 * @type {boolean} is the db connection will not open
 * @private
 */
DbManager.prototype._isOpenError = false;

/**
 * @type {boolean} Is reading/writing messages allowed?
 * @private
 */
DbManager.prototype._permission_messages = false;

/**
 * @type {boolean} Is reading/writing conversations allowed?
 * @private
 */
DbManager.prototype._permission_conversations = false;

/**
 * @type {boolean} Is reading/writing unsent server requests allowed?
 * @private
 */
DbManager.prototype._permission_syncQueue = false;

/**
 * @type IDBDatabase
 */
DbManager.prototype.db = null;

/**
 * Rich Content may be written to indexeddb and persisted... if its size is less than this number of bytes.
 *
 * This value can be customized; this example only writes Rich Content that is less than 5000 bytes
 *
 *    layer.DbManager.MaxPartSize = 5000;
 *
 * @static
 * @type {Number}
 */
DbManager.MaxPartSize = 250000;

DbManager._supportedEvents = [
  'open', 'error',
];

Root.initClass.apply(DbManager, [DbManager, 'DbManager']);
module.exports = DbManager;
