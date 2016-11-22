'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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

var Root = require('./root');
var logger = require('./logger');
var SyncEvent = require('./sync-event');
var Constants = require('./const');
var Util = require('./client-utils');

var DB_VERSION = 2;
var MAX_SAFE_INTEGER = 9007199254740991;
var SYNC_NEW = Constants.SYNC_STATE.NEW;

function getDate(inDate) {
  return inDate ? inDate.toISOString() : null;
}

var TABLES = [{
  name: 'conversations',
  indexes: {
    created_at: ['created_at'],
    last_message_sent: ['last_message_sent']
  }
}, {
  name: 'messages',
  indexes: {
    conversation: ['conversation', 'position']
  }
}, {
  name: 'identities',
  indexes: {}
}, {
  name: 'syncQueue',
  indexes: {}
}];

var DbManager = function (_Root) {
  _inherits(DbManager, _Root);

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
  function DbManager(options) {
    _classCallCheck(this, DbManager);

    // If no indexedDB, treat everything as disabled.
    /* istanbul ignore next */
    var _this = _possibleConstructorReturn(this, (DbManager.__proto__ || Object.getPrototypeOf(DbManager)).call(this, options));

    if (!window.indexedDB) {
      options.tables = {};
    } else {
      // Test if Arrays as keys supported, disable persistence if not
      var enabled = true;
      try {
        window.IDBKeyRange.bound(['announcement', 0], ['announcement', MAX_SAFE_INTEGER]);
      } catch (e) {
        options.tables = {};
        enabled = false;
      }

      // If Client is a layer.ClientAuthenticator, it won't support these events; this affects Unit Tests
      if (enabled && _this.client.constructor._supportedEvents.indexOf('conversations:add') !== -1) {
        _this.client.on('conversations:add', function (evt) {
          return _this.writeConversations(evt.conversations);
        });

        _this.client.on('conversations:change', function (evt) {
          return _this._updateConversation(evt.target, evt.changes);
        });
        _this.client.on('conversations:delete conversations:sent-error', function (evt) {
          return _this.deleteObjects('conversations', [evt.target]);
        });

        _this.client.on('messages:add', function (evt) {
          return _this.writeMessages(evt.messages);
        });
        _this.client.on('messages:change', function (evt) {
          return _this.writeMessages([evt.target]);
        });
        _this.client.on('messages:delete messages:sent-error', function (evt) {
          return _this.deleteObjects('messages', [evt.target]);
        });

        _this.client.on('identities:add', function (evt) {
          return _this.writeIdentities(evt.identities);
        });
        _this.client.on('identities:change', function (evt) {
          return _this.writeIdentities([evt.target]);
        });
        _this.client.on('identities:unfollow', function (evt) {
          return _this.deleteObjects('identities', [evt.target]);
        });
      }

      // Sync Queue only really works properly if we have the Messages and Conversations written to the DB; turn it off
      // if that won't be the case.
      if (!options.tables.conversations || !options.tables.messages) {
        options.tables.syncQueue = false;
      }
    }

    TABLES.forEach(function (tableDef) {
      _this['_permission_' + tableDef.name] = Boolean(options.tables[tableDef.name]);
    });
    _this._open(false);
    return _this;
  }

  _createClass(DbManager, [{
    key: '_getDbName',
    value: function _getDbName() {
      return 'LayerWebSDK_' + this.client.appId;
    }

    /**
     * Open the Database Connection.
     *
     * This is only called by the constructor.
     * @method _open
     * @param {Boolean} retry
     * @private
     */

  }, {
    key: '_open',
    value: function _open(retry) {
      var _this2 = this;

      if (this.db) {
        this.db.close();
        delete this.db;
      }

      // Abort if all tables are disabled
      var enabledTables = TABLES.filter(function (tableDef) {
        return _this2['_permission_' + tableDef.name];
      });
      if (enabledTables.length === 0) {
        this._isOpenError = true;
        this.trigger('error', { error: 'Persistence is disabled by application' });
        return;
      }

      // Open the database
      var client = this.client;
      var request = window.indexedDB.open(this._getDbName(), DB_VERSION);

      try {
        request.onerror = function (evt) {
          if (!retry) {
            _this2.deleteTables(function () {
              return _this2._open(true);
            });
          }

          // Triggered by Firefox private browsing window
          /* istanbul ignore next */
          else {
              _this2._isOpenError = true;
              logger.warn('Database Unable to Open (common cause: private browsing window)', evt.target.error);
              _this2.trigger('error', { error: evt });
            }
        };

        request.onupgradeneeded = function (evt) {
          return _this2._onUpgradeNeeded(evt);
        };
        request.onsuccess = function (evt) {
          _this2.db = evt.target.result;
          _this2.isOpen = true;
          _this2.trigger('open');

          _this2.db.onversionchange = function () {
            _this2.db.close();
            _this2.isOpen = false;
          };

          _this2.db.onerror = function (err) {
            return logger.error('db-manager Error: ', err);
          };
        };
      }

      /* istanbul ignore next */
      catch (err) {
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

  }, {
    key: 'onOpen',
    value: function onOpen(callback) {
      if (this.isOpen || this._isOpenError) callback();else this.once('open error', callback);
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

  }, {
    key: '_onUpgradeNeeded',
    value: function _onUpgradeNeeded(event) {
      var _this3 = this;

      var db = event.target.result;
      var isComplete = false;

      // This appears to only get called once; its presumed this is because we're creating but not using a lot of transactions.
      var onComplete = function onComplete(evt) {
        if (!isComplete) {
          _this3.db = db;
          _this3.isComplete = true;
          _this3.isOpen = true;
          _this3.trigger('open');
        }
      };

      var currentTables = Array.prototype.slice.call(db.objectStoreNames);
      TABLES.forEach(function (tableDef) {
        try {
          if (currentTables.indexOf(tableDef.name) !== -1) db.deleteObjectStore(tableDef.name);
        } catch (e) {
          // Noop
        }
        try {
          (function () {
            var store = db.createObjectStore(tableDef.name, { keyPath: 'id' });
            Object.keys(tableDef.indexes).forEach(function (indexName) {
              return store.createIndex(indexName, tableDef.indexes[indexName], { unique: false });
            });
            store.transaction.oncomplete = onComplete;
          })();
        } catch (e) {
          // Noop
          logger.error('Failed to create object store ' + tableDef.name, e);
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

  }, {
    key: '_getConversationData',
    value: function _getConversationData(conversations) {
      var _this4 = this;

      return conversations.filter(function (conversation) {
        if (conversation._fromDB) {
          conversation._fromDB = false;
          return false;
        } else if (conversation.isLoading || conversation.syncState === SYNC_NEW) {
          return false;
        } else {
          return true;
        }
      }).map(function (conversation) {
        var item = {
          id: conversation.id,
          url: conversation.url,
          participants: _this4._getIdentityData(conversation.participants, true),
          distinct: conversation.distinct,
          created_at: getDate(conversation.createdAt),
          metadata: conversation.metadata,
          unread_message_count: conversation.unreadCount,
          last_message: conversation.lastMessage ? conversation.lastMessage.id : '',
          last_message_sent: conversation.lastMessage ? getDate(conversation.lastMessage.sentAt) : getDate(conversation.createdAt),
          sync_state: conversation.syncState
        };
        return item;
      });
    }
  }, {
    key: '_updateConversation',
    value: function _updateConversation(conversation, changes) {
      var _this5 = this;

      var idChanges = changes.filter(function (item) {
        return item.property === 'id';
      });
      if (idChanges.length) {
        this.deleteObjects('conversations', [{ id: idChanges[0].oldValue }], function () {
          _this5.writeConversations([conversation]);
        });
      } else {
        this.writeConversations([conversation]);
      }
    }

    /**
     * Writes an array of Conversations to the Database.
     *
     * @method writeConversations
     * @param {layer.Conversation[]} conversations - Array of Conversations to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeConversations',
    value: function writeConversations(conversations, callback) {
      this._writeObjects('conversations', this._getConversationData(conversations.filter(function (conversation) {
        return !conversation.isDestroyed;
      })), callback);
    }

    /**
     * Convert array of Identity instances into Identity DB Entries.
     *
     * @method _getIdentityData
     * @private
     * @param {layer.Identity[]} identities
     * @param {boolean} writeBasicIdentity - Forces output as a Basic Identity
     * @return {Object[]} identities
     */

  }, {
    key: '_getIdentityData',
    value: function _getIdentityData(identities, writeBasicIdentity) {
      return identities.filter(function (identity) {
        if (identity.isDestroyed || !identity.isFullIdentity && !writeBasicIdentity) return false;

        if (identity._fromDB) {
          identity._fromDB = false;
          return false;
        } else if (identity.isLoading) {
          return false;
        } else {
          return true;
        }
      }).map(function (identity) {
        if (identity.isFullIdentity && !writeBasicIdentity) {
          return {
            id: identity.id,
            url: identity.url,
            user_id: identity.userId,
            first_name: identity.firstName,
            last_name: identity.lastName,
            display_name: identity.displayName,
            avatar_url: identity.avatarUrl,
            metadata: identity.metadata,
            public_key: identity.publicKey,
            phone_number: identity.phoneNumber,
            email_address: identity.emailAddress,
            sync_state: identity.syncState,
            type: identity.type
          };
        } else {
          return {
            id: identity.id,
            url: identity.url,
            user_id: identity.userId,
            display_name: identity.displayName,
            avatar_url: identity.avatarUrl
          };
        }
      });
    }

    /**
     * Writes an array of Identities to the Database.
     *
     * @method writeIdentities
     * @param {layer.Identity[]} identities - Array of Identities to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeIdentities',
    value: function writeIdentities(identities, callback) {
      this._writeObjects('identities', this._getIdentityData(identities), callback);
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

  }, {
    key: '_getMessageData',
    value: function _getMessageData(messages, callback) {
      var _this6 = this;

      var dbMessages = messages.filter(function (message) {
        if (message._fromDB) {
          message._fromDB = false;
          return false;
        } else if (message.syncState === Constants.SYNC_STATE.LOADING) {
          return false;
        } else {
          return true;
        }
      }).map(function (message) {
        return {
          id: message.id,
          url: message.url,
          parts: message.parts.map(function (part) {
            var body = Util.isBlob(part.body) && part.body.size > DbManager.MaxPartSize ? null : part.body;
            return {
              body: body,
              id: part.id,
              encoding: part.encoding,
              mime_type: part.mimeType,
              content: !part._content ? null : {
                id: part._content.id,
                download_url: part._content.downloadUrl,
                expiration: part._content.expiration,
                refresh_url: part._content.refreshUrl,
                size: part._content.size
              }
            };
          }),
          position: message.position,
          sender: _this6._getIdentityData([message.sender], true)[0],
          recipient_status: message.recipientStatus,
          sent_at: getDate(message.sentAt),
          received_at: getDate(message.receivedAt),
          conversation: message.constructor.prefixUUID === 'layer:///announcements/' ? 'announcement' : message.conversationId,
          sync_state: message.syncState,
          is_unread: message.isUnread
        };
      });

      // Find all blobs and convert them to base64... because Safari 9.1 doesn't support writing blobs those Frelling Smurfs.
      var count = 0;
      var parts = [];
      dbMessages.forEach(function (message) {
        message.parts.forEach(function (part) {
          if (Util.isBlob(part.body)) parts.push(part);
        });
      });
      if (parts.length === 0) {
        callback(dbMessages);
      } else {
        parts.forEach(function (part) {
          Util.blobToBase64(part.body, function (base64) {
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
     * @method writeMessages
     * @param {layer.Message[]} messages - Array of Messages to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeMessages',
    value: function writeMessages(messages, callback) {
      var _this7 = this;

      this._getMessageData(messages.filter(function (message) {
        return !message.isDestroyed;
      }), function (dbMessageData) {
        return _this7._writeObjects('messages', dbMessageData, callback);
      });
    }

    /**
     * Convert array of SyncEvent instances into SyncEvent DB Entries.
     *
     * @method _getSyncEventData
     * @param {layer.SyncEvent[]} syncEvents
     * @return {Object[]} syncEvents
     * @private
     */

  }, {
    key: '_getSyncEventData',
    value: function _getSyncEventData(syncEvents) {
      return syncEvents.filter(function (syncEvt) {
        if (syncEvt.fromDB) {
          syncEvt.fromDB = false;
          return false;
        } else {
          return true;
        }
      }).map(function (syncEvent) {
        var item = {
          id: syncEvent.id,
          target: syncEvent.target,
          depends: syncEvent.depends,
          isWebsocket: syncEvent instanceof SyncEvent.WebsocketSyncEvent,
          operation: syncEvent.operation,
          data: syncEvent.data,
          url: syncEvent.url || '',
          headers: syncEvent.headers || null,
          method: syncEvent.method || null,
          created_at: syncEvent.createdAt
        };
        return item;
      });
    }

    /**
     * Writes an array of SyncEvent to the Database.
     *
     * @method writeSyncEvents
     * @param {layer.SyncEvent[]} syncEvents - Array of Sync Events to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeSyncEvents',
    value: function writeSyncEvents(syncEvents, callback) {
      this._writeObjects('syncQueue', this._getSyncEventData(syncEvents), callback);
    }

    /**
     * Write an array of data to the specified Database table.
     *
     * @method _writeObjects
     * @param {string} tableName - The name of the table to write to
     * @param {Object[]} data - Array of POJO data to write
     * @param {Function} [callback] - Called when all data is written
     * @protected
     */

  }, {
    key: '_writeObjects',
    value: function _writeObjects(tableName, data, callback) {
      var _this8 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;

      // Just quit if no data to write
      if (!data.length) {
        if (callback) callback();
        return;
      }

      // PUT (udpate) or ADD (insert) each item of data one at a time, but all as part of one large transaction.
      this.onOpen(function () {
        _this8.getObjects(tableName, data.map(function (item) {
          return item.id;
        }), function (foundItems) {
          var updateIds = {};
          foundItems.forEach(function (item) {
            updateIds[item.id] = item;
          });

          var transaction = _this8.db.transaction([tableName], 'readwrite');
          var store = transaction.objectStore(tableName);
          transaction.oncomplete = transaction.onerror = callback;

          data.forEach(function (item) {
            try {
              if (updateIds[item.id]) {
                store.put(item);
              } else {
                store.add(item);
              }
            } catch (e) {
              // Safari throws an error rather than use the onerror event.
              logger.error(e);
            }
          });
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

  }, {
    key: 'loadConversations',
    value: function loadConversations(sortBy, fromId, pageSize, callback) {
      var _this9 = this;

      try {
        var sortIndex = void 0,
            range = null;
        var fromConversation = fromId ? this.client.getConversation(fromId) : null;
        if (sortBy === 'last_message') {
          sortIndex = 'last_message_sent';
          if (fromConversation) {
            range = window.IDBKeyRange.upperBound([fromConversation.lastMessage ? getDate(fromConversation.lastMessage.sentAt) : getDate(fromConversation.createdAt)]);
          }
        } else {
          sortIndex = 'created_at';
          if (fromConversation) {
            range = window.IDBKeyRange.upperBound([getDate(fromConversation.createdAt)]);
          }
        }

        // Step 1: Get all Conversations
        this._loadByIndex('conversations', sortIndex, range, Boolean(fromId), pageSize, function (data) {
          // Step 2: Gather all Message IDs needed to initialize these Conversation's lastMessage properties.
          var messagesToLoad = data.map(function (item) {
            return item.last_message;
          }).filter(function (messageId) {
            return messageId && !_this9.client.getMessage(messageId);
          });

          // Step 3: Load all Messages needed to initialize these Conversation's lastMessage properties.
          _this9.getObjects('messages', messagesToLoad, function (messages) {
            _this9._loadConversationsResult(data, messages, callback);
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

  }, {
    key: '_loadConversationsResult',
    value: function _loadConversationsResult(conversations, messages, callback) {
      var _this10 = this;

      // Instantiate and Register each Message
      messages.forEach(function (message) {
        return _this10._createMessage(message);
      });

      // Instantiate and Register each Conversation; will find any lastMessage that was registered.
      var newData = conversations.map(function (conversation) {
        return _this10._createConversation(conversation) || _this10.client.getConversation(conversation.id);
      }).filter(function (conversation) {
        return conversation;
      });

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

  }, {
    key: 'loadMessages',
    value: function loadMessages(conversationId, fromId, pageSize, callback) {
      var _this11 = this;

      try {
        var fromMessage = fromId ? this.client.getMessage(fromId) : null;
        var query = window.IDBKeyRange.bound([conversationId, 0], [conversationId, fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
        this._loadByIndex('messages', 'conversation', query, Boolean(fromId), pageSize, function (data) {
          _this11._loadMessagesResult(data, callback);
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

  }, {
    key: 'loadAnnouncements',
    value: function loadAnnouncements(fromId, pageSize, callback) {
      var _this12 = this;

      try {
        var fromMessage = fromId ? this.client.getMessage(fromId) : null;
        var query = window.IDBKeyRange.bound(['announcement', 0], ['announcement', fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
        this._loadByIndex('messages', 'conversation', query, Boolean(fromId), pageSize, function (data) {
          _this12._loadMessagesResult(data, callback);
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }
  }, {
    key: '_blobifyPart',
    value: function _blobifyPart(part) {
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

  }, {
    key: '_loadMessagesResult',
    value: function _loadMessagesResult(messages, callback) {
      var _this13 = this;

      // Convert base64 to blob before sending it along...
      messages.forEach(function (message) {
        return message.parts.forEach(function (part) {
          return _this13._blobifyPart(part);
        });
      });

      // Instantiate and Register each Message
      var newData = messages.map(function (message) {
        return _this13._createMessage(message) || _this13.client.getMessage(message.id);
      }).filter(function (message) {
        return message;
      });

      // Return the results
      if (callback) callback(newData);
    }

    /**
     * Load all Identities from the database.
     *
     * @method loadIdentities
     * @param {Function} callback
     * @param {layer.Identity[]} callback.result
     */

  }, {
    key: 'loadIdentities',
    value: function loadIdentities(callback) {
      var _this14 = this;

      this._loadAll('identities', function (data) {
        _this14._loadIdentitiesResult(data, callback);
      });
    }

    /**
     * Assemble all LastMessages and Identityy POJOs into layer.Message and layer.Identityy instances.
     *
     * @method _loadIdentitiesResult
     * @private
     * @param {Object[]} identities
     * @param {Function} callback
     * @param {layer.Identity[]} callback.result
     */

  }, {
    key: '_loadIdentitiesResult',
    value: function _loadIdentitiesResult(identities, callback) {
      var _this15 = this;

      // Instantiate and Register each Identity.
      var newData = identities.map(function (identity) {
        return _this15._createIdentity(identity) || _this15.client.getIdentity(identity.id);
      }).filter(function (identity) {
        return identity;
      });

      // Return the data
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

  }, {
    key: '_createConversation',
    value: function _createConversation(conversation) {
      if (!this.client.getConversation(conversation.id)) {
        conversation._fromDB = true;
        var newConversation = this.client._createObject(conversation);
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

  }, {
    key: '_createMessage',
    value: function _createMessage(message) {
      if (!this.client.getMessage(message.id)) {
        message._fromDB = true;
        message.conversation = { id: message.conversation };
        var newMessage = this.client._createObject(message);
        newMessage.syncState = message.sync_state;
        return newMessage;
      }
    }

    /**
     * Instantiate and Register the Identity from an identities DB Entry.
     *
     * If the layer.Identity already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * @method _createIdentity
     * @param {Object} identity
     * @returns {layer.Identity}
     */

  }, {
    key: '_createIdentity',
    value: function _createIdentity(identity) {
      if (!this.client.getIdentity(identity.id)) {
        identity._fromDB = true;
        var newidentity = this.client._createObject(identity);
        newidentity.syncState = identity.sync_state;
        return newidentity;
      }
    }

    /**
     * Load all Sync Events from the database.
     *
     * @method loadSyncQueue
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: 'loadSyncQueue',
    value: function loadSyncQueue(callback) {
      var _this16 = this;

      this._loadAll('syncQueue', function (syncEvents) {
        return _this16._loadSyncEventRelatedData(syncEvents, callback);
      });
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

  }, {
    key: '_loadSyncEventRelatedData',
    value: function _loadSyncEventRelatedData(syncEvents, callback) {
      var _this17 = this;

      // Gather all Message IDs that are targets of operations.
      var messageIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/messages/);
      }).map(function (item) {
        return item.target;
      });

      // Gather all Conversation IDs that are targets of operations.
      var conversationIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/conversations/);
      }).map(function (item) {
        return item.target;
      });

      var identityIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/identities/);
      }).map(function (item) {
        return item.target;
      });

      // Load any Messages/Conversations that are targets of operations.
      // Call _createMessage or _createConversation on all targets found.
      var counter = 0;
      var maxCounter = 3;
      this.getObjects('messages', messageIds, function (messages) {
        messages.forEach(function (message) {
          return _this17._createMessage(message);
        });
        counter++;
        if (counter === maxCounter) _this17._loadSyncEventResults(syncEvents, callback);
      });
      this.getObjects('conversations', conversationIds, function (conversations) {
        conversations.forEach(function (conversation) {
          return _this17._createConversation(conversation);
        });
        counter++;
        if (counter === maxCounter) _this17._loadSyncEventResults(syncEvents, callback);
      });
      this.getObjects('identities', identityIds, function (identities) {
        identities.forEach(function (identity) {
          return _this17._createIdentity(identity);
        });
        counter++;
        if (counter === maxCounter) _this17._loadSyncEventResults(syncEvents, callback);
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

  }, {
    key: '_loadSyncEventResults',
    value: function _loadSyncEventResults(syncEvents, callback) {
      var _this18 = this;

      // If the target is present in the sync event, but does not exist in the system,
      // do NOT attempt to instantiate this event... unless its a DELETE operation.
      var newData = syncEvents.filter(function (syncEvent) {
        var hasTarget = Boolean(syncEvent.target && _this18.client._getObject(syncEvent.target));
        return syncEvent.operation === 'DELETE' || hasTarget;
      }).map(function (syncEvent) {
        if (syncEvent.isWebsocket) {
          return new SyncEvent.WebsocketSyncEvent({
            target: syncEvent.target,
            depends: syncEvent.depends,
            operation: syncEvent.operation,
            id: syncEvent.id,
            data: syncEvent.data,
            fromDB: true,
            createdAt: syncEvent.created_at
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
            createdAt: syncEvent.created_at
          });
        }
      });

      // Sort the results and then return them.
      // TODO: Query results should come back sorted by database with proper Index
      Util.sortBy(newData, function (item) {
        return item.createdAt;
      });
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

  }, {
    key: '_loadAll',
    value: function _loadAll(tableName, callback) {
      var _this19 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      this.onOpen(function () {
        var data = [];
        _this19.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (cursor) {
            data.push(cursor.value);
            cursor.continue();
          } else if (!_this19.isDestroyed) {
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
     * @param {String} tableName - 'messages', 'conversations', 'identities'
     * @param {String} indexName - Name of the index to query on
     * @param {IDBKeyRange} range - Range to Query for (null ok)
     * @param {Boolean} isFromId - If querying for results after a specified ID, then we want to skip the first result (which will be that ID) ("" is OK)
     * @param {number} pageSize - If a value is provided, return at most that number of results; else return all results.
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: '_loadByIndex',
    value: function _loadByIndex(tableName, indexName, range, isFromId, pageSize, callback) {
      var _this20 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      var shouldSkipNext = isFromId;
      this.onOpen(function () {
        var data = [];
        _this20.db.transaction([tableName], 'readonly').objectStore(tableName).index(indexName).openCursor(range, 'prev').onsuccess = function (evt) {
          var cursor = evt.target.result;
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
          } else if (!_this20.isDestroyed) {
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

  }, {
    key: 'deleteObjects',
    value: function deleteObjects(tableName, data, callback) {
      var _this21 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;
      this.onOpen(function () {
        var transaction = _this21.db.transaction([tableName], 'readwrite');
        var store = transaction.objectStore(tableName);
        transaction.oncomplete = callback;
        data.forEach(function (item) {
          return store.delete(item.id);
        });
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

  }, {
    key: 'getObjects',
    value: function getObjects(tableName, ids, callback) {
      var _this22 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      var data = [];

      // Gather, sort, and filter replica IDs
      var sortedIds = ids.sort();
      for (var i = sortedIds.length - 1; i > 0; i--) {
        if (sortedIds[i] === sortedIds[i - 1]) sortedIds.splice(i, 1);
      }
      var index = 0;

      // Iterate over the table searching for the specified IDs
      this.onOpen(function () {
        _this22.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (!cursor) {
            callback(data);
            return;
          }
          var key = cursor.key;

          // The cursor has passed beyond this key. Check next.
          while (key > sortedIds[index]) {
            index++;
          } // The cursor is pointing at one of our IDs, get it and check next.
          if (key === sortedIds[index]) {
            data.push(cursor.value);
            index++;
          }

          // Done or check next
          if (index === sortedIds.length) {
            if (!_this22.isDestroyed) callback(data);
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

  }, {
    key: 'getObject',
    value: function getObject(tableName, id, callback) {
      var _this23 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback();

      this.onOpen(function () {
        _this23.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor(window.IDBKeyRange.only(id)).onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (!cursor) return callback(null);

          switch (tableName) {
            case 'messages':
              cursor.value.conversation = {
                id: cursor.value.conversation
              };
              // Convert base64 to blob before sending it along...
              cursor.value.parts.forEach(function (part) {
                return _this23._blobifyPart(part);
              });
              return callback(cursor.value);
            case 'identities':
              return callback(cursor.value);
            case 'conversations':
              if (cursor.value.last_message && !_this23.client.getMessage(cursor.value.last_message)) {
                return _this23.getObject('messages', cursor.value.last_message, function (message) {
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

  }, {
    key: 'claimSyncEvent',
    value: function claimSyncEvent(syncEvent, callback) {
      var _this24 = this;

      if (!this._permission_syncQueue || this._isOpenError) return callback(true);
      this.onOpen(function () {
        var transaction = _this24.db.transaction(['syncQueue'], 'readwrite');
        var store = transaction.objectStore('syncQueue');
        store.get(syncEvent.id).onsuccess = function (evt) {
          return callback(Boolean(evt.target.result));
        };
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

  }, {
    key: 'deleteTables',
    value: function deleteTables() {
      var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

      try {
        var request = window.indexedDB.deleteDatabase(this._getDbName());
        request.onsuccess = request.onerror = callback;
        delete this.db;
      } catch (e) {
        logger.error('Failed to delete database', e);
        if (callback) callback(e);
      }
    }
  }]);

  return DbManager;
}(Root);

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
 * @type {boolean} Is reading/writing identities allowed?
 * @private
 */
DbManager.prototype._permission_identities = false;

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

DbManager._supportedEvents = ['open', 'error'].concat(Root._supportedEvents);

Root.initClass.apply(DbManager, [DbManager, 'DbManager']);
module.exports = DbManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kYi1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwibG9nZ2VyIiwiU3luY0V2ZW50IiwiQ29uc3RhbnRzIiwiVXRpbCIsIkRCX1ZFUlNJT04iLCJNQVhfU0FGRV9JTlRFR0VSIiwiU1lOQ19ORVciLCJTWU5DX1NUQVRFIiwiTkVXIiwiZ2V0RGF0ZSIsImluRGF0ZSIsInRvSVNPU3RyaW5nIiwiVEFCTEVTIiwibmFtZSIsImluZGV4ZXMiLCJjcmVhdGVkX2F0IiwibGFzdF9tZXNzYWdlX3NlbnQiLCJjb252ZXJzYXRpb24iLCJEYk1hbmFnZXIiLCJvcHRpb25zIiwid2luZG93IiwiaW5kZXhlZERCIiwidGFibGVzIiwiZW5hYmxlZCIsIklEQktleVJhbmdlIiwiYm91bmQiLCJlIiwiY2xpZW50IiwiY29uc3RydWN0b3IiLCJfc3VwcG9ydGVkRXZlbnRzIiwiaW5kZXhPZiIsIm9uIiwid3JpdGVDb252ZXJzYXRpb25zIiwiZXZ0IiwiY29udmVyc2F0aW9ucyIsIl91cGRhdGVDb252ZXJzYXRpb24iLCJ0YXJnZXQiLCJjaGFuZ2VzIiwiZGVsZXRlT2JqZWN0cyIsIndyaXRlTWVzc2FnZXMiLCJtZXNzYWdlcyIsIndyaXRlSWRlbnRpdGllcyIsImlkZW50aXRpZXMiLCJzeW5jUXVldWUiLCJmb3JFYWNoIiwidGFibGVEZWYiLCJCb29sZWFuIiwiX29wZW4iLCJhcHBJZCIsInJldHJ5IiwiZGIiLCJjbG9zZSIsImVuYWJsZWRUYWJsZXMiLCJmaWx0ZXIiLCJsZW5ndGgiLCJfaXNPcGVuRXJyb3IiLCJ0cmlnZ2VyIiwiZXJyb3IiLCJyZXF1ZXN0Iiwib3BlbiIsIl9nZXREYk5hbWUiLCJvbmVycm9yIiwiZGVsZXRlVGFibGVzIiwid2FybiIsIm9udXBncmFkZW5lZWRlZCIsIl9vblVwZ3JhZGVOZWVkZWQiLCJvbnN1Y2Nlc3MiLCJyZXN1bHQiLCJpc09wZW4iLCJvbnZlcnNpb25jaGFuZ2UiLCJlcnIiLCJjYWxsYmFjayIsIm9uY2UiLCJldmVudCIsImlzQ29tcGxldGUiLCJvbkNvbXBsZXRlIiwiY3VycmVudFRhYmxlcyIsIkFycmF5IiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwib2JqZWN0U3RvcmVOYW1lcyIsImRlbGV0ZU9iamVjdFN0b3JlIiwic3RvcmUiLCJjcmVhdGVPYmplY3RTdG9yZSIsImtleVBhdGgiLCJPYmplY3QiLCJrZXlzIiwiY3JlYXRlSW5kZXgiLCJpbmRleE5hbWUiLCJ1bmlxdWUiLCJ0cmFuc2FjdGlvbiIsIm9uY29tcGxldGUiLCJfZnJvbURCIiwiaXNMb2FkaW5nIiwic3luY1N0YXRlIiwibWFwIiwiaXRlbSIsImlkIiwidXJsIiwicGFydGljaXBhbnRzIiwiX2dldElkZW50aXR5RGF0YSIsImRpc3RpbmN0IiwiY3JlYXRlZEF0IiwibWV0YWRhdGEiLCJ1bnJlYWRfbWVzc2FnZV9jb3VudCIsInVucmVhZENvdW50IiwibGFzdF9tZXNzYWdlIiwibGFzdE1lc3NhZ2UiLCJzZW50QXQiLCJzeW5jX3N0YXRlIiwiaWRDaGFuZ2VzIiwicHJvcGVydHkiLCJvbGRWYWx1ZSIsIl93cml0ZU9iamVjdHMiLCJfZ2V0Q29udmVyc2F0aW9uRGF0YSIsImlzRGVzdHJveWVkIiwid3JpdGVCYXNpY0lkZW50aXR5IiwiaWRlbnRpdHkiLCJpc0Z1bGxJZGVudGl0eSIsInVzZXJfaWQiLCJ1c2VySWQiLCJmaXJzdF9uYW1lIiwiZmlyc3ROYW1lIiwibGFzdF9uYW1lIiwibGFzdE5hbWUiLCJkaXNwbGF5X25hbWUiLCJkaXNwbGF5TmFtZSIsImF2YXRhcl91cmwiLCJhdmF0YXJVcmwiLCJwdWJsaWNfa2V5IiwicHVibGljS2V5IiwicGhvbmVfbnVtYmVyIiwicGhvbmVOdW1iZXIiLCJlbWFpbF9hZGRyZXNzIiwiZW1haWxBZGRyZXNzIiwidHlwZSIsImRiTWVzc2FnZXMiLCJtZXNzYWdlIiwiTE9BRElORyIsInBhcnRzIiwiYm9keSIsImlzQmxvYiIsInBhcnQiLCJzaXplIiwiTWF4UGFydFNpemUiLCJlbmNvZGluZyIsIm1pbWVfdHlwZSIsIm1pbWVUeXBlIiwiY29udGVudCIsIl9jb250ZW50IiwiZG93bmxvYWRfdXJsIiwiZG93bmxvYWRVcmwiLCJleHBpcmF0aW9uIiwicmVmcmVzaF91cmwiLCJyZWZyZXNoVXJsIiwicG9zaXRpb24iLCJzZW5kZXIiLCJyZWNpcGllbnRfc3RhdHVzIiwicmVjaXBpZW50U3RhdHVzIiwic2VudF9hdCIsInJlY2VpdmVkX2F0IiwicmVjZWl2ZWRBdCIsInByZWZpeFVVSUQiLCJjb252ZXJzYXRpb25JZCIsImlzX3VucmVhZCIsImlzVW5yZWFkIiwiY291bnQiLCJwdXNoIiwiYmxvYlRvQmFzZTY0IiwiYmFzZTY0IiwidXNlQmxvYiIsIl9nZXRNZXNzYWdlRGF0YSIsImRiTWVzc2FnZURhdGEiLCJzeW5jRXZlbnRzIiwic3luY0V2dCIsImZyb21EQiIsInN5bmNFdmVudCIsImRlcGVuZHMiLCJpc1dlYnNvY2tldCIsIldlYnNvY2tldFN5bmNFdmVudCIsIm9wZXJhdGlvbiIsImRhdGEiLCJoZWFkZXJzIiwibWV0aG9kIiwiX2dldFN5bmNFdmVudERhdGEiLCJ0YWJsZU5hbWUiLCJvbk9wZW4iLCJnZXRPYmplY3RzIiwiZm91bmRJdGVtcyIsInVwZGF0ZUlkcyIsIm9iamVjdFN0b3JlIiwicHV0IiwiYWRkIiwic29ydEJ5IiwiZnJvbUlkIiwicGFnZVNpemUiLCJzb3J0SW5kZXgiLCJyYW5nZSIsImZyb21Db252ZXJzYXRpb24iLCJnZXRDb252ZXJzYXRpb24iLCJ1cHBlckJvdW5kIiwiX2xvYWRCeUluZGV4IiwibWVzc2FnZXNUb0xvYWQiLCJtZXNzYWdlSWQiLCJnZXRNZXNzYWdlIiwiX2xvYWRDb252ZXJzYXRpb25zUmVzdWx0IiwiX2NyZWF0ZU1lc3NhZ2UiLCJuZXdEYXRhIiwiX2NyZWF0ZUNvbnZlcnNhdGlvbiIsImZyb21NZXNzYWdlIiwicXVlcnkiLCJfbG9hZE1lc3NhZ2VzUmVzdWx0IiwiYmFzZTY0VG9CbG9iIiwiX2Jsb2JpZnlQYXJ0IiwiX2xvYWRBbGwiLCJfbG9hZElkZW50aXRpZXNSZXN1bHQiLCJfY3JlYXRlSWRlbnRpdHkiLCJnZXRJZGVudGl0eSIsIm5ld0NvbnZlcnNhdGlvbiIsIl9jcmVhdGVPYmplY3QiLCJuZXdNZXNzYWdlIiwibmV3aWRlbnRpdHkiLCJfbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhIiwibWVzc2FnZUlkcyIsIm1hdGNoIiwiY29udmVyc2F0aW9uSWRzIiwiaWRlbnRpdHlJZHMiLCJjb3VudGVyIiwibWF4Q291bnRlciIsIl9sb2FkU3luY0V2ZW50UmVzdWx0cyIsImhhc1RhcmdldCIsIl9nZXRPYmplY3QiLCJYSFJTeW5jRXZlbnQiLCJvcGVuQ3Vyc29yIiwiY3Vyc29yIiwidmFsdWUiLCJjb250aW51ZSIsImlzRnJvbUlkIiwic2hvdWxkU2tpcE5leHQiLCJpbmRleCIsImRlbGV0ZSIsImlkcyIsInNvcnRlZElkcyIsInNvcnQiLCJpIiwic3BsaWNlIiwia2V5Iiwib25seSIsImdldE9iamVjdCIsIl9wZXJtaXNzaW9uX3N5bmNRdWV1ZSIsImdldCIsImRlbGV0ZURhdGFiYXNlIiwiX3Blcm1pc3Npb25fbWVzc2FnZXMiLCJfcGVybWlzc2lvbl9jb252ZXJzYXRpb25zIiwiX3Blcm1pc3Npb25faWRlbnRpdGllcyIsImNvbmNhdCIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7OztBQWNBLElBQU1BLE9BQU9DLFFBQVEsUUFBUixDQUFiO0FBQ0EsSUFBTUMsU0FBU0QsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFNRSxZQUFZRixRQUFRLGNBQVIsQ0FBbEI7QUFDQSxJQUFNRyxZQUFZSCxRQUFRLFNBQVIsQ0FBbEI7QUFDQSxJQUFNSSxPQUFPSixRQUFRLGdCQUFSLENBQWI7O0FBRUEsSUFBTUssYUFBYSxDQUFuQjtBQUNBLElBQU1DLG1CQUFtQixnQkFBekI7QUFDQSxJQUFNQyxXQUFXSixVQUFVSyxVQUFWLENBQXFCQyxHQUF0Qzs7QUFFQSxT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NEQsU0FBVixDQUFvQjVCLEVBQXBCLEdBQXlCLElBQXpCOztBQUVBOzs7Ozs7Ozs7O0FBVUFoQyxVQUFVK0gsV0FBVixHQUF3QixNQUF4Qjs7QUFFQS9ILFVBQVVXLGdCQUFWLEdBQTZCLENBQzNCLE1BRDJCLEVBQ25CLE9BRG1CLEVBRTNCbU8sTUFGMkIsQ0FFcEJsUSxLQUFLK0IsZ0JBRmUsQ0FBN0I7O0FBSUEvQixLQUFLbVEsU0FBTCxDQUFlQyxLQUFmLENBQXFCaFAsU0FBckIsRUFBZ0MsQ0FBQ0EsU0FBRCxFQUFZLFdBQVosQ0FBaEM7QUFDQWlQLE9BQU9DLE9BQVAsR0FBaUJsUCxTQUFqQiIsImZpbGUiOiJkYi1tYW5hZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQZXJzaXN0ZW5jZSBtYW5hZ2VyLlxuICpcbiAqIFRoaXMgY2xhc3MgbWFuYWdlcyBhbGwgaW5kZXhlZERCIGFjY2Vzcy4gIEl0IGlzIG5vdCByZXNwb25zaWJsZSBmb3IgYW55IGxvY2FsU3RvcmFnZSBhY2Nlc3MsIHRob3VnaCBpdCBtYXlcbiAqIHJlY2VpdmUgY29uZmlndXJhdGlvbnMgcmVsYXRlZCB0byBkYXRhIHN0b3JlZCBpbiBsb2NhbFN0b3JhZ2UuICBJdCB3aWxsIHNpbXBseSBpZ25vcmUgdGhvc2UgY29uZmlndXJhdGlvbnMuXG4gKlxuICogUmljaCBDb250ZW50IHdpbGwgYmUgd3JpdHRlbiB0byBJbmRleGVkREIgYXMgbG9uZyBhcyBpdHMgc21hbGw7IHNlZSBsYXllci5EYk1hbmFnZXIuTWF4UGFydFNpemUgZm9yIG1vcmUgaW5mby5cbiAqXG4gKiBUT0RPOlxuICogMC4gUmVkZXNpZ24gdGhpcyBzbyB0aGF0IGtub3dsZWRnZSBvZiB0aGUgZGF0YSBpcyBub3QgaGFyZC1jb2RlZCBpblxuICogQGNsYXNzIGxheWVyLkRiTWFuYWdlclxuICogQHByb3RlY3RlZFxuICovXG5cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBTeW5jRXZlbnQgPSByZXF1aXJlKCcuL3N5bmMtZXZlbnQnKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4vY29uc3QnKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuXG5jb25zdCBEQl9WRVJTSU9OID0gMjtcbmNvbnN0IE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuY29uc3QgU1lOQ19ORVcgPSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVc7XG5cbmZ1bmN0aW9uIGdldERhdGUoaW5EYXRlKSB7XG4gIHJldHVybiBpbkRhdGUgPyBpbkRhdGUudG9JU09TdHJpbmcoKSA6IG51bGw7XG59XG5cbmNvbnN0IFRBQkxFUyA9IFtcbiAge1xuICAgIG5hbWU6ICdjb252ZXJzYXRpb25zJyxcbiAgICBpbmRleGVzOiB7XG4gICAgICBjcmVhdGVkX2F0OiBbJ2NyZWF0ZWRfYXQnXSxcbiAgICAgIGxhc3RfbWVzc2FnZV9zZW50OiBbJ2xhc3RfbWVzc2FnZV9zZW50J11cbiAgICB9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ21lc3NhZ2VzJyxcbiAgICBpbmRleGVzOiB7XG4gICAgICBjb252ZXJzYXRpb246IFsnY29udmVyc2F0aW9uJywgJ3Bvc2l0aW9uJ11cbiAgICB9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ2lkZW50aXRpZXMnLFxuICAgIGluZGV4ZXM6IHt9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ3N5bmNRdWV1ZScsXG4gICAgaW5kZXhlczoge30sXG4gIH0sXG5dO1xuXG5jbGFzcyBEYk1hbmFnZXIgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ3JlYXRlIHRoZSBEQiBNYW5hZ2VyXG4gICAqXG4gICAqIEtleSBjb25maWd1cmF0aW9uIGlzIHRoZSBsYXllci5EYk1hbmFnZXIucGVyc2lzdGVuY2VGZWF0dXJlcyBwcm9wZXJ0eS5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gb3B0aW9ucy5jbGllbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucGVyc2lzdGVuY2VGZWF0dXJlc1xuICAgKiBAcmV0dXJuIHtsYXllci5EYk1hbmFnZXJ9IHRoaXNcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIElmIG5vIGluZGV4ZWREQiwgdHJlYXQgZXZlcnl0aGluZyBhcyBkaXNhYmxlZC5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICghd2luZG93LmluZGV4ZWREQikge1xuICAgICAgb3B0aW9ucy50YWJsZXMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGVzdCBpZiBBcnJheXMgYXMga2V5cyBzdXBwb3J0ZWQsIGRpc2FibGUgcGVyc2lzdGVuY2UgaWYgbm90XG4gICAgICBsZXQgZW5hYmxlZCA9IHRydWU7XG4gICAgICB0cnkge1xuICAgICAgICB3aW5kb3cuSURCS2V5UmFuZ2UuYm91bmQoWydhbm5vdW5jZW1lbnQnLCAwXSwgWydhbm5vdW5jZW1lbnQnLCBNQVhfU0FGRV9JTlRFR0VSXSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZXMgPSB7fTtcbiAgICAgICAgZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBDbGllbnQgaXMgYSBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yLCBpdCB3b24ndCBzdXBwb3J0IHRoZXNlIGV2ZW50czsgdGhpcyBhZmZlY3RzIFVuaXQgVGVzdHNcbiAgICAgIGlmIChlbmFibGVkICYmIHRoaXMuY2xpZW50LmNvbnN0cnVjdG9yLl9zdXBwb3J0ZWRFdmVudHMuaW5kZXhPZignY29udmVyc2F0aW9uczphZGQnKSAhPT0gLTEpIHtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6YWRkJywgZXZ0ID0+IHRoaXMud3JpdGVDb252ZXJzYXRpb25zKGV2dC5jb252ZXJzYXRpb25zKSk7XG5cbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJywgZXZ0ID0+IHRoaXMuX3VwZGF0ZUNvbnZlcnNhdGlvbihldnQudGFyZ2V0LCBldnQuY2hhbmdlcykpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbignY29udmVyc2F0aW9uczpkZWxldGUgY29udmVyc2F0aW9uczpzZW50LWVycm9yJywgZXZ0ID0+IHRoaXMuZGVsZXRlT2JqZWN0cygnY29udmVyc2F0aW9ucycsIFtldnQudGFyZ2V0XSkpO1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdtZXNzYWdlczphZGQnLCBldnQgPT4gdGhpcy53cml0ZU1lc3NhZ2VzKGV2dC5tZXNzYWdlcykpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZXM6Y2hhbmdlJywgZXZ0ID0+IHRoaXMud3JpdGVNZXNzYWdlcyhbZXZ0LnRhcmdldF0pKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2VzOmRlbGV0ZSBtZXNzYWdlczpzZW50LWVycm9yJywgZXZ0ID0+IHRoaXMuZGVsZXRlT2JqZWN0cygnbWVzc2FnZXMnLCBbZXZ0LnRhcmdldF0pKTtcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignaWRlbnRpdGllczphZGQnLCBldnQgPT4gdGhpcy53cml0ZUlkZW50aXRpZXMoZXZ0LmlkZW50aXRpZXMpKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2lkZW50aXRpZXM6Y2hhbmdlJywgZXZ0ID0+IHRoaXMud3JpdGVJZGVudGl0aWVzKFtldnQudGFyZ2V0XSkpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbignaWRlbnRpdGllczp1bmZvbGxvdycsIGV2dCA9PiB0aGlzLmRlbGV0ZU9iamVjdHMoJ2lkZW50aXRpZXMnLCBbZXZ0LnRhcmdldF0pKTtcbiAgICAgIH1cblxuICAgICAgLy8gU3luYyBRdWV1ZSBvbmx5IHJlYWxseSB3b3JrcyBwcm9wZXJseSBpZiB3ZSBoYXZlIHRoZSBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucyB3cml0dGVuIHRvIHRoZSBEQjsgdHVybiBpdCBvZmZcbiAgICAgIC8vIGlmIHRoYXQgd29uJ3QgYmUgdGhlIGNhc2UuXG4gICAgICBpZiAoIW9wdGlvbnMudGFibGVzLmNvbnZlcnNhdGlvbnMgfHwgIW9wdGlvbnMudGFibGVzLm1lc3NhZ2VzKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVzLnN5bmNRdWV1ZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIFRBQkxFUy5mb3JFYWNoKCh0YWJsZURlZikgPT4ge1xuICAgICAgdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlRGVmLm5hbWVdID0gQm9vbGVhbihvcHRpb25zLnRhYmxlc1t0YWJsZURlZi5uYW1lXSk7XG4gICAgfSk7XG4gICAgdGhpcy5fb3BlbihmYWxzZSk7XG4gIH1cblxuICBfZ2V0RGJOYW1lKCkge1xuICAgIHJldHVybiAnTGF5ZXJXZWJTREtfJyArIHRoaXMuY2xpZW50LmFwcElkO1xuICB9XG5cbiAgLyoqXG4gICAqIE9wZW4gdGhlIERhdGFiYXNlIENvbm5lY3Rpb24uXG4gICAqXG4gICAqIFRoaXMgaXMgb25seSBjYWxsZWQgYnkgdGhlIGNvbnN0cnVjdG9yLlxuICAgKiBAbWV0aG9kIF9vcGVuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gcmV0cnlcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9vcGVuKHJldHJ5KSB7XG4gICAgaWYgKHRoaXMuZGIpIHtcbiAgICAgIHRoaXMuZGIuY2xvc2UoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmRiO1xuICAgIH1cblxuICAgIC8vIEFib3J0IGlmIGFsbCB0YWJsZXMgYXJlIGRpc2FibGVkXG4gICAgY29uc3QgZW5hYmxlZFRhYmxlcyA9IFRBQkxFUy5maWx0ZXIodGFibGVEZWYgPT4gdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlRGVmLm5hbWVdKTtcbiAgICBpZiAoZW5hYmxlZFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuX2lzT3BlbkVycm9yID0gdHJ1ZTtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCB7IGVycm9yOiAnUGVyc2lzdGVuY2UgaXMgZGlzYWJsZWQgYnkgYXBwbGljYXRpb24nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9wZW4gdGhlIGRhdGFiYXNlXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5jbGllbnQ7XG4gICAgY29uc3QgcmVxdWVzdCA9IHdpbmRvdy5pbmRleGVkREIub3Blbih0aGlzLl9nZXREYk5hbWUoKSwgREJfVkVSU0lPTik7XG5cbiAgICB0cnkge1xuICAgICAgcmVxdWVzdC5vbmVycm9yID0gKGV2dCkgPT4ge1xuICAgICAgICBpZiAoIXJldHJ5KSB7XG4gICAgICAgICAgdGhpcy5kZWxldGVUYWJsZXMoKCkgPT4gdGhpcy5fb3Blbih0cnVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUcmlnZ2VyZWQgYnkgRmlyZWZveCBwcml2YXRlIGJyb3dzaW5nIHdpbmRvd1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9pc09wZW5FcnJvciA9IHRydWU7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oJ0RhdGFiYXNlIFVuYWJsZSB0byBPcGVuIChjb21tb24gY2F1c2U6IHByaXZhdGUgYnJvd3Npbmcgd2luZG93KScsIGV2dC50YXJnZXQuZXJyb3IpO1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCB7IGVycm9yOiBldnQgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gKGV2dCkgPT4gdGhpcy5fb25VcGdyYWRlTmVlZGVkKGV2dCk7XG4gICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IChldnQpID0+IHtcbiAgICAgICAgdGhpcy5kYiA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICB0aGlzLmlzT3BlbiA9IHRydWU7XG4gICAgICAgIHRoaXMudHJpZ2dlcignb3BlbicpO1xuXG4gICAgICAgIHRoaXMuZGIub252ZXJzaW9uY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgIHRoaXMuZGIuY2xvc2UoKTtcbiAgICAgICAgICB0aGlzLmlzT3BlbiA9IGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZGIub25lcnJvciA9IGVyciA9PiBsb2dnZXIuZXJyb3IoJ2RiLW1hbmFnZXIgRXJyb3I6ICcsIGVycik7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgY2F0Y2goZXJyKSB7XG4gICAgICAvLyBTYWZhcmkgUHJpdmF0ZSBCcm93c2luZyB3aW5kb3cgd2lsbCBmYWlsIG9uIHJlcXVlc3Qub25lcnJvclxuICAgICAgdGhpcy5faXNPcGVuRXJyb3IgPSB0cnVlO1xuICAgICAgbG9nZ2VyLmVycm9yKCdEYXRhYmFzZSBVbmFibGUgdG8gT3BlbjogJywgZXJyKTtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCB7IGVycm9yOiBlcnIgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZSB0aGlzIHRvIHNldHVwIGEgY2FsbCB0byBoYXBwZW4gYXMgc29vbiBhcyB0aGUgZGF0YWJhc2UgaXMgb3Blbi5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB0aGlzIGNhbGwgd2lsbCBpbW1lZGlhdGVseSwgc3luY2hyb25vdXNseSBjYWxsIHlvdXIgY2FsbGJhY2suXG4gICAqIEJ1dCBpZiB0aGUgREIgaXMgbm90IG9wZW4geWV0LCB5b3VyIGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIG9uY2UgaXRzIG9wZW4uXG4gICAqIEBtZXRob2Qgb25PcGVuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBvbk9wZW4oY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5pc09wZW4gfHwgdGhpcy5faXNPcGVuRXJyb3IpIGNhbGxiYWNrKCk7XG4gICAgZWxzZSB0aGlzLm9uY2UoJ29wZW4gZXJyb3InLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9uVXBncmFkZU5lZWRlZCBmdW5jdGlvbiBpcyBjYWxsZWQgYnkgSW5kZXhlZERCIGFueSB0aW1lIERCX1ZFUlNJT04gaXMgaW5jcmVtZW50ZWQuXG4gICAqXG4gICAqIFRoaXMgaW52b2NhdGlvbiBpcyBwYXJ0IG9mIHRoZSBidWlsdC1pbiBsaWZlY3ljbGUgb2YgSW5kZXhlZERCLlxuICAgKlxuICAgKiBAbWV0aG9kIF9vblVwZ3JhZGVOZWVkZWRcbiAgICogQHBhcmFtIHtJREJWZXJzaW9uQ2hhbmdlRXZlbnR9IGV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBfb25VcGdyYWRlTmVlZGVkKGV2ZW50KSB7XG4gICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgIGxldCBpc0NvbXBsZXRlID0gZmFsc2U7XG5cbiAgICAvLyBUaGlzIGFwcGVhcnMgdG8gb25seSBnZXQgY2FsbGVkIG9uY2U7IGl0cyBwcmVzdW1lZCB0aGlzIGlzIGJlY2F1c2Ugd2UncmUgY3JlYXRpbmcgYnV0IG5vdCB1c2luZyBhIGxvdCBvZiB0cmFuc2FjdGlvbnMuXG4gICAgdmFyIG9uQ29tcGxldGUgPSAoZXZ0KSA9PiB7XG4gICAgICBpZiAoIWlzQ29tcGxldGUpIHtcbiAgICAgICAgdGhpcy5kYiA9IGRiO1xuICAgICAgICB0aGlzLmlzQ29tcGxldGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmlzT3BlbiA9IHRydWU7XG4gICAgICAgIHRoaXMudHJpZ2dlcignb3BlbicpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBjdXJyZW50VGFibGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGIub2JqZWN0U3RvcmVOYW1lcyk7XG4gICAgVEFCTEVTLmZvckVhY2goKHRhYmxlRGVmKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoY3VycmVudFRhYmxlcy5pbmRleE9mKHRhYmxlRGVmLm5hbWUpICE9PSAtMSkgZGIuZGVsZXRlT2JqZWN0U3RvcmUodGFibGVEZWYubmFtZSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIE5vb3BcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUodGFibGVEZWYubmFtZSwgeyBrZXlQYXRoOiAnaWQnIH0pO1xuICAgICAgICBPYmplY3Qua2V5cyh0YWJsZURlZi5pbmRleGVzKVxuICAgICAgICAgIC5mb3JFYWNoKGluZGV4TmFtZSA9PiBzdG9yZS5jcmVhdGVJbmRleChpbmRleE5hbWUsIHRhYmxlRGVmLmluZGV4ZXNbaW5kZXhOYW1lXSwgeyB1bmlxdWU6IGZhbHNlIH0pKTtcbiAgICAgICAgc3RvcmUudHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IG9uQ29tcGxldGU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIE5vb3BcbiAgICAgICAgbG9nZ2VyLmVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIG9iamVjdCBzdG9yZSAke3RhYmxlRGVmLm5hbWV9YCwgZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhcnJheSBvZiBDb252ZXJzYXRpb24gaW5zdGFuY2VzIGludG8gQ29udmVyc2F0aW9uIERCIEVudHJpZXMuXG4gICAqXG4gICAqIEEgQ29udmVyc2F0aW9uIERCIGVudHJ5IGxvb2tzIGEgbG90IGxpa2UgdGhlIHNlcnZlciByZXByZXNlbnRhdGlvbiwgYnV0XG4gICAqIGluY2x1ZGVzIGEgc3luY19zdGF0ZSBwcm9wZXJ0eSwgYW5kIGBsYXN0X21lc3NhZ2VgIGNvbnRhaW5zIGEgbWVzc2FnZSBJRCBub3RcbiAgICogYSBNZXNzYWdlIG9iamVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0Q29udmVyc2F0aW9uRGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbltdfSBjb252ZXJzYXRpb25zXG4gICAqIEByZXR1cm4ge09iamVjdFtdfSBjb252ZXJzYXRpb25zXG4gICAqL1xuICBfZ2V0Q29udmVyc2F0aW9uRGF0YShjb252ZXJzYXRpb25zKSB7XG4gICAgcmV0dXJuIGNvbnZlcnNhdGlvbnMuZmlsdGVyKGNvbnZlcnNhdGlvbiA9PiB7XG4gICAgICBpZiAoY29udmVyc2F0aW9uLl9mcm9tREIpIHtcbiAgICAgICAgY29udmVyc2F0aW9uLl9mcm9tREIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb24uaXNMb2FkaW5nIHx8IGNvbnZlcnNhdGlvbi5zeW5jU3RhdGUgPT09IFNZTkNfTkVXKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pLm1hcChjb252ZXJzYXRpb24gPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHtcbiAgICAgICAgaWQ6IGNvbnZlcnNhdGlvbi5pZCxcbiAgICAgICAgdXJsOiBjb252ZXJzYXRpb24udXJsLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IHRoaXMuX2dldElkZW50aXR5RGF0YShjb252ZXJzYXRpb24ucGFydGljaXBhbnRzLCB0cnVlKSxcbiAgICAgICAgZGlzdGluY3Q6IGNvbnZlcnNhdGlvbi5kaXN0aW5jdCxcbiAgICAgICAgY3JlYXRlZF9hdDogZ2V0RGF0ZShjb252ZXJzYXRpb24uY3JlYXRlZEF0KSxcbiAgICAgICAgbWV0YWRhdGE6IGNvbnZlcnNhdGlvbi5tZXRhZGF0YSxcbiAgICAgICAgdW5yZWFkX21lc3NhZ2VfY291bnQ6IGNvbnZlcnNhdGlvbi51bnJlYWRDb3VudCxcbiAgICAgICAgbGFzdF9tZXNzYWdlOiBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgPyBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UuaWQgOiAnJyxcbiAgICAgICAgbGFzdF9tZXNzYWdlX3NlbnQ6IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSA/IGdldERhdGUoY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLnNlbnRBdCkgOiBnZXREYXRlKGNvbnZlcnNhdGlvbi5jcmVhdGVkQXQpLFxuICAgICAgICBzeW5jX3N0YXRlOiBjb252ZXJzYXRpb24uc3luY1N0YXRlLFxuICAgICAgfTtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH0pO1xuICB9XG5cbiAgX3VwZGF0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24sIGNoYW5nZXMpIHtcbiAgICB2YXIgaWRDaGFuZ2VzID0gY2hhbmdlcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnByb3BlcnR5ID09PSAnaWQnKTtcbiAgICBpZiAoaWRDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAgdGhpcy5kZWxldGVPYmplY3RzKCdjb252ZXJzYXRpb25zJywgW3tpZDogaWRDaGFuZ2VzWzBdLm9sZFZhbHVlfV0sICgpID0+IHtcbiAgICAgICAgdGhpcy53cml0ZUNvbnZlcnNhdGlvbnMoW2NvbnZlcnNhdGlvbl0pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMud3JpdGVDb252ZXJzYXRpb25zKFtjb252ZXJzYXRpb25dKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGFuIGFycmF5IG9mIENvbnZlcnNhdGlvbnMgdG8gdGhlIERhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIHdyaXRlQ29udmVyc2F0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbltdfSBjb252ZXJzYXRpb25zIC0gQXJyYXkgb2YgQ29udmVyc2F0aW9ucyB0byB3cml0ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqL1xuICB3cml0ZUNvbnZlcnNhdGlvbnMoY29udmVyc2F0aW9ucywgY2FsbGJhY2spIHtcbiAgICB0aGlzLl93cml0ZU9iamVjdHMoJ2NvbnZlcnNhdGlvbnMnLFxuICAgICAgdGhpcy5fZ2V0Q29udmVyc2F0aW9uRGF0YShjb252ZXJzYXRpb25zLmZpbHRlcihjb252ZXJzYXRpb24gPT4gIWNvbnZlcnNhdGlvbi5pc0Rlc3Ryb3llZCkpLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhcnJheSBvZiBJZGVudGl0eSBpbnN0YW5jZXMgaW50byBJZGVudGl0eSBEQiBFbnRyaWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRJZGVudGl0eURhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBpZGVudGl0aWVzXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVCYXNpY0lkZW50aXR5IC0gRm9yY2VzIG91dHB1dCBhcyBhIEJhc2ljIElkZW50aXR5XG4gICAqIEByZXR1cm4ge09iamVjdFtdfSBpZGVudGl0aWVzXG4gICAqL1xuICBfZ2V0SWRlbnRpdHlEYXRhKGlkZW50aXRpZXMsIHdyaXRlQmFzaWNJZGVudGl0eSkge1xuICAgIHJldHVybiBpZGVudGl0aWVzLmZpbHRlcigoaWRlbnRpdHkpID0+IHtcbiAgICAgIGlmIChpZGVudGl0eS5pc0Rlc3Ryb3llZCB8fCAhaWRlbnRpdHkuaXNGdWxsSWRlbnRpdHkgJiYgIXdyaXRlQmFzaWNJZGVudGl0eSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoaWRlbnRpdHkuX2Zyb21EQikge1xuICAgICAgICBpZGVudGl0eS5fZnJvbURCID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoaWRlbnRpdHkuaXNMb2FkaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pLm1hcCgoaWRlbnRpdHkpID0+IHtcbiAgICAgIGlmIChpZGVudGl0eS5pc0Z1bGxJZGVudGl0eSAmJiAhd3JpdGVCYXNpY0lkZW50aXR5KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IGlkZW50aXR5LmlkLFxuICAgICAgICAgIHVybDogaWRlbnRpdHkudXJsLFxuICAgICAgICAgIHVzZXJfaWQ6IGlkZW50aXR5LnVzZXJJZCxcbiAgICAgICAgICBmaXJzdF9uYW1lOiBpZGVudGl0eS5maXJzdE5hbWUsXG4gICAgICAgICAgbGFzdF9uYW1lOiBpZGVudGl0eS5sYXN0TmFtZSxcbiAgICAgICAgICBkaXNwbGF5X25hbWU6IGlkZW50aXR5LmRpc3BsYXlOYW1lLFxuICAgICAgICAgIGF2YXRhcl91cmw6IGlkZW50aXR5LmF2YXRhclVybCxcbiAgICAgICAgICBtZXRhZGF0YTogaWRlbnRpdHkubWV0YWRhdGEsXG4gICAgICAgICAgcHVibGljX2tleTogaWRlbnRpdHkucHVibGljS2V5LFxuICAgICAgICAgIHBob25lX251bWJlcjogaWRlbnRpdHkucGhvbmVOdW1iZXIsXG4gICAgICAgICAgZW1haWxfYWRkcmVzczogaWRlbnRpdHkuZW1haWxBZGRyZXNzLFxuICAgICAgICAgIHN5bmNfc3RhdGU6IGlkZW50aXR5LnN5bmNTdGF0ZSxcbiAgICAgICAgICB0eXBlOiBpZGVudGl0eS50eXBlLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogaWRlbnRpdHkuaWQsXG4gICAgICAgICAgdXJsOiBpZGVudGl0eS51cmwsXG4gICAgICAgICAgdXNlcl9pZDogaWRlbnRpdHkudXNlcklkLFxuICAgICAgICAgIGRpc3BsYXlfbmFtZTogaWRlbnRpdHkuZGlzcGxheU5hbWUsXG4gICAgICAgICAgYXZhdGFyX3VybDogaWRlbnRpdHkuYXZhdGFyVXJsLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhbiBhcnJheSBvZiBJZGVudGl0aWVzIHRvIHRoZSBEYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCB3cml0ZUlkZW50aXRpZXNcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBpZGVudGl0aWVzIC0gQXJyYXkgb2YgSWRlbnRpdGllcyB0byB3cml0ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqL1xuICB3cml0ZUlkZW50aXRpZXMoaWRlbnRpdGllcywgY2FsbGJhY2spIHtcbiAgICB0aGlzLl93cml0ZU9iamVjdHMoJ2lkZW50aXRpZXMnLFxuICAgICAgdGhpcy5fZ2V0SWRlbnRpdHlEYXRhKGlkZW50aXRpZXMpLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhcnJheSBvZiBNZXNzYWdlIGluc3RhbmNlcyBpbnRvIE1lc3NhZ2UgREIgRW50cmllcy5cbiAgICpcbiAgICogQSBNZXNzYWdlIERCIGVudHJ5IGxvb2tzIGEgbG90IGxpa2UgdGhlIHNlcnZlciByZXByZXNlbnRhdGlvbiwgYnV0XG4gICAqIGluY2x1ZGVzIGEgc3luY19zdGF0ZSBwcm9wZXJ0eS5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0TWVzc2FnZURhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlW119IG1lc3NhZ2VzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm4ge09iamVjdFtdfSBtZXNzYWdlc1xuICAgKi9cbiAgX2dldE1lc3NhZ2VEYXRhKG1lc3NhZ2VzLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRiTWVzc2FnZXMgPSBtZXNzYWdlcy5maWx0ZXIobWVzc2FnZSA9PiB7XG4gICAgICBpZiAobWVzc2FnZS5fZnJvbURCKSB7XG4gICAgICAgIG1lc3NhZ2UuX2Zyb21EQiA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKG1lc3NhZ2Uuc3luY1N0YXRlID09PSBDb25zdGFudHMuU1lOQ19TVEFURS5MT0FESU5HKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pLm1hcChtZXNzYWdlID0+ICh7XG4gICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgIHVybDogbWVzc2FnZS51cmwsXG4gICAgICBwYXJ0czogbWVzc2FnZS5wYXJ0cy5tYXAocGFydCA9PiB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBVdGlsLmlzQmxvYihwYXJ0LmJvZHkpICYmIHBhcnQuYm9keS5zaXplID4gRGJNYW5hZ2VyLk1heFBhcnRTaXplID8gbnVsbCA6IHBhcnQuYm9keTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBib2R5LFxuICAgICAgICAgIGlkOiBwYXJ0LmlkLFxuICAgICAgICAgIGVuY29kaW5nOiBwYXJ0LmVuY29kaW5nLFxuICAgICAgICAgIG1pbWVfdHlwZTogcGFydC5taW1lVHlwZSxcbiAgICAgICAgICBjb250ZW50OiAhcGFydC5fY29udGVudCA/IG51bGwgOiB7XG4gICAgICAgICAgICBpZDogcGFydC5fY29udGVudC5pZCxcbiAgICAgICAgICAgIGRvd25sb2FkX3VybDogcGFydC5fY29udGVudC5kb3dubG9hZFVybCxcbiAgICAgICAgICAgIGV4cGlyYXRpb246IHBhcnQuX2NvbnRlbnQuZXhwaXJhdGlvbixcbiAgICAgICAgICAgIHJlZnJlc2hfdXJsOiBwYXJ0Ll9jb250ZW50LnJlZnJlc2hVcmwsXG4gICAgICAgICAgICBzaXplOiBwYXJ0Ll9jb250ZW50LnNpemUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgIH0pLFxuICAgICAgcG9zaXRpb246IG1lc3NhZ2UucG9zaXRpb24sXG4gICAgICBzZW5kZXI6IHRoaXMuX2dldElkZW50aXR5RGF0YShbbWVzc2FnZS5zZW5kZXJdLCB0cnVlKVswXSxcbiAgICAgIHJlY2lwaWVudF9zdGF0dXM6IG1lc3NhZ2UucmVjaXBpZW50U3RhdHVzLFxuICAgICAgc2VudF9hdDogZ2V0RGF0ZShtZXNzYWdlLnNlbnRBdCksXG4gICAgICByZWNlaXZlZF9hdDogZ2V0RGF0ZShtZXNzYWdlLnJlY2VpdmVkQXQpLFxuICAgICAgY29udmVyc2F0aW9uOiBtZXNzYWdlLmNvbnN0cnVjdG9yLnByZWZpeFVVSUQgPT09ICdsYXllcjovLy9hbm5vdW5jZW1lbnRzLycgPyAnYW5ub3VuY2VtZW50JyA6IG1lc3NhZ2UuY29udmVyc2F0aW9uSWQsXG4gICAgICBzeW5jX3N0YXRlOiBtZXNzYWdlLnN5bmNTdGF0ZSxcbiAgICAgIGlzX3VucmVhZDogbWVzc2FnZS5pc1VucmVhZCxcbiAgICB9KSk7XG5cbiAgICAvLyBGaW5kIGFsbCBibG9icyBhbmQgY29udmVydCB0aGVtIHRvIGJhc2U2NC4uLiBiZWNhdXNlIFNhZmFyaSA5LjEgZG9lc24ndCBzdXBwb3J0IHdyaXRpbmcgYmxvYnMgdGhvc2UgRnJlbGxpbmcgU211cmZzLlxuICAgIGxldCBjb3VudCA9IDA7XG4gICAgY29uc3QgcGFydHMgPSBbXTtcbiAgICBkYk1lc3NhZ2VzLmZvckVhY2goKG1lc3NhZ2UpID0+IHtcbiAgICAgIG1lc3NhZ2UucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgICBpZiAoVXRpbC5pc0Jsb2IocGFydC5ib2R5KSkgcGFydHMucHVzaChwYXJ0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhbGxiYWNrKGRiTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICAgIFV0aWwuYmxvYlRvQmFzZTY0KHBhcnQuYm9keSwgKGJhc2U2NCkgPT4ge1xuICAgICAgICAgIHBhcnQuYm9keSA9IGJhc2U2NDtcbiAgICAgICAgICBwYXJ0LnVzZUJsb2IgPSB0cnVlO1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSBwYXJ0cy5sZW5ndGgpIGNhbGxiYWNrKGRiTWVzc2FnZXMpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gYXJyYXkgb2YgTWVzc2FnZXMgdG8gdGhlIERhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIHdyaXRlTWVzc2FnZXNcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlW119IG1lc3NhZ2VzIC0gQXJyYXkgb2YgTWVzc2FnZXMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVNZXNzYWdlcyhtZXNzYWdlcywgY2FsbGJhY2spIHtcbiAgICB0aGlzLl9nZXRNZXNzYWdlRGF0YShcbiAgICAgIG1lc3NhZ2VzLmZpbHRlcihtZXNzYWdlID0+ICFtZXNzYWdlLmlzRGVzdHJveWVkKSxcbiAgICAgIGRiTWVzc2FnZURhdGEgPT4gdGhpcy5fd3JpdGVPYmplY3RzKCdtZXNzYWdlcycsIGRiTWVzc2FnZURhdGEsIGNhbGxiYWNrKVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhcnJheSBvZiBTeW5jRXZlbnQgaW5zdGFuY2VzIGludG8gU3luY0V2ZW50IERCIEVudHJpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFN5bmNFdmVudERhdGFcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnRbXX0gc3luY0V2ZW50c1xuICAgKiBAcmV0dXJuIHtPYmplY3RbXX0gc3luY0V2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldFN5bmNFdmVudERhdGEoc3luY0V2ZW50cykge1xuICAgIHJldHVybiBzeW5jRXZlbnRzLmZpbHRlcihzeW5jRXZ0ID0+IHtcbiAgICAgIGlmIChzeW5jRXZ0LmZyb21EQikge1xuICAgICAgICBzeW5jRXZ0LmZyb21EQiA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KS5tYXAoc3luY0V2ZW50ID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB7XG4gICAgICAgIGlkOiBzeW5jRXZlbnQuaWQsXG4gICAgICAgIHRhcmdldDogc3luY0V2ZW50LnRhcmdldCxcbiAgICAgICAgZGVwZW5kczogc3luY0V2ZW50LmRlcGVuZHMsXG4gICAgICAgIGlzV2Vic29ja2V0OiBzeW5jRXZlbnQgaW5zdGFuY2VvZiBTeW5jRXZlbnQuV2Vic29ja2V0U3luY0V2ZW50LFxuICAgICAgICBvcGVyYXRpb246IHN5bmNFdmVudC5vcGVyYXRpb24sXG4gICAgICAgIGRhdGE6IHN5bmNFdmVudC5kYXRhLFxuICAgICAgICB1cmw6IHN5bmNFdmVudC51cmwgfHwgJycsXG4gICAgICAgIGhlYWRlcnM6IHN5bmNFdmVudC5oZWFkZXJzIHx8IG51bGwsXG4gICAgICAgIG1ldGhvZDogc3luY0V2ZW50Lm1ldGhvZCB8fCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0OiBzeW5jRXZlbnQuY3JlYXRlZEF0LFxuICAgICAgfTtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhbiBhcnJheSBvZiBTeW5jRXZlbnQgdG8gdGhlIERhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIHdyaXRlU3luY0V2ZW50c1xuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudFtdfSBzeW5jRXZlbnRzIC0gQXJyYXkgb2YgU3luYyBFdmVudHMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVTeW5jRXZlbnRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fd3JpdGVPYmplY3RzKCdzeW5jUXVldWUnLCB0aGlzLl9nZXRTeW5jRXZlbnREYXRhKHN5bmNFdmVudHMpLCBjYWxsYmFjayk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBXcml0ZSBhbiBhcnJheSBvZiBkYXRhIHRvIHRoZSBzcGVjaWZpZWQgRGF0YWJhc2UgdGFibGUuXG4gICAqXG4gICAqIEBtZXRob2QgX3dyaXRlT2JqZWN0c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gdGFibGVOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHRhYmxlIHRvIHdyaXRlIHRvXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGRhdGEgLSBBcnJheSBvZiBQT0pPIGRhdGEgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAtIENhbGxlZCB3aGVuIGFsbCBkYXRhIGlzIHdyaXR0ZW5cbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgX3dyaXRlT2JqZWN0cyh0YWJsZU5hbWUsIGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzWydfcGVybWlzc2lvbl8nICsgdGFibGVOYW1lXSB8fCB0aGlzLl9pc09wZW5FcnJvcikgcmV0dXJuIGNhbGxiYWNrID8gY2FsbGJhY2soKSA6IG51bGw7XG5cbiAgICAvLyBKdXN0IHF1aXQgaWYgbm8gZGF0YSB0byB3cml0ZVxuICAgIGlmICghZGF0YS5sZW5ndGgpIHtcbiAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBQVVQgKHVkcGF0ZSkgb3IgQUREIChpbnNlcnQpIGVhY2ggaXRlbSBvZiBkYXRhIG9uZSBhdCBhIHRpbWUsIGJ1dCBhbGwgYXMgcGFydCBvZiBvbmUgbGFyZ2UgdHJhbnNhY3Rpb24uXG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgdGhpcy5nZXRPYmplY3RzKHRhYmxlTmFtZSwgZGF0YS5tYXAoaXRlbSA9PiBpdGVtLmlkKSwgKGZvdW5kSXRlbXMpID0+IHtcbiAgICAgICAgY29uc3QgdXBkYXRlSWRzID0ge307XG4gICAgICAgIGZvdW5kSXRlbXMuZm9yRWFjaChpdGVtID0+IHsgdXBkYXRlSWRzW2l0ZW0uaWRdID0gaXRlbTsgfSk7XG5cbiAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSB0aGlzLmRiLnRyYW5zYWN0aW9uKFt0YWJsZU5hbWVdLCAncmVhZHdyaXRlJyk7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUodGFibGVOYW1lKTtcbiAgICAgICAgdHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IHRyYW5zYWN0aW9uLm9uZXJyb3IgPSBjYWxsYmFjaztcblxuICAgICAgICBkYXRhLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh1cGRhdGVJZHNbaXRlbS5pZF0pIHtcbiAgICAgICAgICAgICAgc3RvcmUucHV0KGl0ZW0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3RvcmUuYWRkKGl0ZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIFNhZmFyaSB0aHJvd3MgYW4gZXJyb3IgcmF0aGVyIHRoYW4gdXNlIHRoZSBvbmVycm9yIGV2ZW50LlxuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBjb252ZXJzYXRpb25zIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRDb252ZXJzYXRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzb3J0QnkgICAgICAgLSBPbmUgb2YgJ2xhc3RfbWVzc2FnZScgb3IgJ2NyZWF0ZWRfYXQnOyBhbHdheXMgc29ydHMgaW4gREVTQyBvcmRlclxuICAgKiBAcGFyYW0ge3N0cmluZ30gW2Zyb21JZD1dICAgIC0gRm9yIHBhZ2luYXRpb24sIHByb3ZpZGUgdGhlIGNvbnZlcnNhdGlvbklkIHRvIGdldCBDb252ZXJzYXRpb25zIGFmdGVyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbcGFnZVNpemU9XSAgLSBUbyBsaW1pdCB0aGUgbnVtYmVyIG9mIHJlc3VsdHMsIHByb3ZpZGUgYSBudW1iZXIgZm9yIGhvdyBtYW55IHJlc3VsdHMgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdICAtIENhbGxiYWNrIGZvciBnZXR0aW5nIHJlc3VsdHNcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBsb2FkQ29udmVyc2F0aW9ucyhzb3J0QnksIGZyb21JZCwgcGFnZVNpemUsIGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBzb3J0SW5kZXgsXG4gICAgICAgIHJhbmdlID0gbnVsbDtcbiAgICAgIGNvbnN0IGZyb21Db252ZXJzYXRpb24gPSBmcm9tSWQgPyB0aGlzLmNsaWVudC5nZXRDb252ZXJzYXRpb24oZnJvbUlkKSA6IG51bGw7XG4gICAgICBpZiAoc29ydEJ5ID09PSAnbGFzdF9tZXNzYWdlJykge1xuICAgICAgICBzb3J0SW5kZXggPSAnbGFzdF9tZXNzYWdlX3NlbnQnO1xuICAgICAgICBpZiAoZnJvbUNvbnZlcnNhdGlvbikge1xuICAgICAgICAgIHJhbmdlID0gd2luZG93LklEQktleVJhbmdlLnVwcGVyQm91bmQoW2Zyb21Db252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgP1xuICAgICAgICAgICAgZ2V0RGF0ZShmcm9tQ29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLnNlbnRBdCkgOiBnZXREYXRlKGZyb21Db252ZXJzYXRpb24uY3JlYXRlZEF0KV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzb3J0SW5kZXggPSAnY3JlYXRlZF9hdCc7XG4gICAgICAgIGlmIChmcm9tQ29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgcmFuZ2UgPSB3aW5kb3cuSURCS2V5UmFuZ2UudXBwZXJCb3VuZChbZ2V0RGF0ZShmcm9tQ29udmVyc2F0aW9uLmNyZWF0ZWRBdCldKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBTdGVwIDE6IEdldCBhbGwgQ29udmVyc2F0aW9uc1xuICAgICAgdGhpcy5fbG9hZEJ5SW5kZXgoJ2NvbnZlcnNhdGlvbnMnLCBzb3J0SW5kZXgsIHJhbmdlLCBCb29sZWFuKGZyb21JZCksIHBhZ2VTaXplLCAoZGF0YSkgPT4ge1xuICAgICAgICAvLyBTdGVwIDI6IEdhdGhlciBhbGwgTWVzc2FnZSBJRHMgbmVlZGVkIHRvIGluaXRpYWxpemUgdGhlc2UgQ29udmVyc2F0aW9uJ3MgbGFzdE1lc3NhZ2UgcHJvcGVydGllcy5cbiAgICAgICAgY29uc3QgbWVzc2FnZXNUb0xvYWQgPSBkYXRhXG4gICAgICAgICAgLm1hcChpdGVtID0+IGl0ZW0ubGFzdF9tZXNzYWdlKVxuICAgICAgICAgIC5maWx0ZXIobWVzc2FnZUlkID0+IG1lc3NhZ2VJZCAmJiAhdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShtZXNzYWdlSWQpKTtcblxuICAgICAgICAvLyBTdGVwIDM6IExvYWQgYWxsIE1lc3NhZ2VzIG5lZWRlZCB0byBpbml0aWFsaXplIHRoZXNlIENvbnZlcnNhdGlvbidzIGxhc3RNZXNzYWdlIHByb3BlcnRpZXMuXG4gICAgICAgIHRoaXMuZ2V0T2JqZWN0cygnbWVzc2FnZXMnLCBtZXNzYWdlc1RvTG9hZCwgKG1lc3NhZ2VzKSA9PiB7XG4gICAgICAgICAgdGhpcy5fbG9hZENvbnZlcnNhdGlvbnNSZXN1bHQoZGF0YSwgbWVzc2FnZXMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOb29wIC0tIGhhbmRsZSBicm93c2VycyBsaWtlIElFIHRoYXQgZG9uJ3QgbGlrZSB0aGVzZSBJREJLZXlSYW5nZXNcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXNzZW1ibGUgYWxsIExhc3RNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9uIFBPSk9zIGludG8gbGF5ZXIuTWVzc2FnZSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uIGluc3RhbmNlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZENvbnZlcnNhdGlvbnNSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gY29udmVyc2F0aW9uc1xuICAgKiBAcGFyYW0ge09iamVjdFtdfSBtZXNzYWdlc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbltdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkQ29udmVyc2F0aW9uc1Jlc3VsdChjb252ZXJzYXRpb25zLCBtZXNzYWdlcywgY2FsbGJhY2spIHtcbiAgICAvLyBJbnN0YW50aWF0ZSBhbmQgUmVnaXN0ZXIgZWFjaCBNZXNzYWdlXG4gICAgbWVzc2FnZXMuZm9yRWFjaChtZXNzYWdlID0+IHRoaXMuX2NyZWF0ZU1lc3NhZ2UobWVzc2FnZSkpO1xuXG4gICAgLy8gSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIGVhY2ggQ29udmVyc2F0aW9uOyB3aWxsIGZpbmQgYW55IGxhc3RNZXNzYWdlIHRoYXQgd2FzIHJlZ2lzdGVyZWQuXG4gICAgY29uc3QgbmV3RGF0YSA9IGNvbnZlcnNhdGlvbnNcbiAgICAgIC5tYXAoY29udmVyc2F0aW9uID0+IHRoaXMuX2NyZWF0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHx8IHRoaXMuY2xpZW50LmdldENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24uaWQpKVxuICAgICAgLmZpbHRlcihjb252ZXJzYXRpb24gPT4gY29udmVyc2F0aW9uKTtcblxuICAgIC8vIFJldHVybiB0aGUgZGF0YVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgbWVzc2FnZXMgZm9yIGEgZ2l2ZW4gQ29udmVyc2F0aW9uIElEIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBVc2UgX2xvYWRBbGwgaWYgbG9hZGluZyBBbGwgTWVzc2FnZXMgcmF0aGVyIHRoYW4gYWxsIE1lc3NhZ2VzIGZvciBhIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkTWVzc2FnZXNcbiAgICogQHBhcmFtIHtzdHJpbmd9IGNvbnZlcnNhdGlvbklkIC0gSUQgb2YgdGhlIENvbnZlcnNhdGlvbiB3aG9zZSBNZXNzYWdlcyBhcmUgb2YgaW50ZXJlc3QuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZnJvbUlkPV0gICAgLSBGb3IgcGFnaW5hdGlvbiwgcHJvdmlkZSB0aGUgbWVzc2FnZUlkIHRvIGdldCBNZXNzYWdlcyBhZnRlclxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2VTaXplPV0gIC0gVG8gbGltaXQgdGhlIG51bWJlciBvZiByZXN1bHRzLCBwcm92aWRlIGEgbnVtYmVyIGZvciBob3cgbWFueSByZXN1bHRzIHRvIHJldHVybi5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgIC0gQ2FsbGJhY2sgZm9yIGdldHRpbmcgcmVzdWx0c1xuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBsb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQsIGZyb21JZCwgcGFnZVNpemUsIGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGZyb21NZXNzYWdlID0gZnJvbUlkID8gdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShmcm9tSWQpIDogbnVsbDtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gd2luZG93LklEQktleVJhbmdlLmJvdW5kKFtjb252ZXJzYXRpb25JZCwgMF0sXG4gICAgICAgIFtjb252ZXJzYXRpb25JZCwgZnJvbU1lc3NhZ2UgPyBmcm9tTWVzc2FnZS5wb3NpdGlvbiA6IE1BWF9TQUZFX0lOVEVHRVJdKTtcbiAgICAgIHRoaXMuX2xvYWRCeUluZGV4KCdtZXNzYWdlcycsICdjb252ZXJzYXRpb24nLCBxdWVyeSwgQm9vbGVhbihmcm9tSWQpLCBwYWdlU2l6ZSwgKGRhdGEpID0+IHtcbiAgICAgICAgdGhpcy5fbG9hZE1lc3NhZ2VzUmVzdWx0KGRhdGEsIGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5vb3AgLS0gaGFuZGxlIGJyb3dzZXJzIGxpa2UgSUUgdGhhdCBkb24ndCBsaWtlIHRoZXNlIElEQktleVJhbmdlc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBBbm5vdW5jZW1lbnRzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRBbm5vdW5jZW1lbnRzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZnJvbUlkPV0gICAgLSBGb3IgcGFnaW5hdGlvbiwgcHJvdmlkZSB0aGUgbWVzc2FnZUlkIHRvIGdldCBBbm5vdW5jZW1lbnRzIGFmdGVyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbcGFnZVNpemU9XSAgLSBUbyBsaW1pdCB0aGUgbnVtYmVyIG9mIHJlc3VsdHMsIHByb3ZpZGUgYSBudW1iZXIgZm9yIGhvdyBtYW55IHJlc3VsdHMgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqIEBwYXJhbSB7bGF5ZXIuQW5ub3VuY2VtZW50W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZEFubm91bmNlbWVudHMoZnJvbUlkLCBwYWdlU2l6ZSwgY2FsbGJhY2spIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZnJvbU1lc3NhZ2UgPSBmcm9tSWQgPyB0aGlzLmNsaWVudC5nZXRNZXNzYWdlKGZyb21JZCkgOiBudWxsO1xuICAgICAgY29uc3QgcXVlcnkgPSB3aW5kb3cuSURCS2V5UmFuZ2UuYm91bmQoWydhbm5vdW5jZW1lbnQnLCAwXSxcbiAgICAgICAgWydhbm5vdW5jZW1lbnQnLCBmcm9tTWVzc2FnZSA/IGZyb21NZXNzYWdlLnBvc2l0aW9uIDogTUFYX1NBRkVfSU5URUdFUl0pO1xuICAgICAgdGhpcy5fbG9hZEJ5SW5kZXgoJ21lc3NhZ2VzJywgJ2NvbnZlcnNhdGlvbicsIHF1ZXJ5LCBCb29sZWFuKGZyb21JZCksIHBhZ2VTaXplLCAoZGF0YSkgPT4ge1xuICAgICAgICB0aGlzLl9sb2FkTWVzc2FnZXNSZXN1bHQoZGF0YSwgY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm9vcCAtLSBoYW5kbGUgYnJvd3NlcnMgbGlrZSBJRSB0aGF0IGRvbid0IGxpa2UgdGhlc2UgSURCS2V5UmFuZ2VzXG4gICAgfVxuICB9XG5cbiAgX2Jsb2JpZnlQYXJ0KHBhcnQpIHtcbiAgICBpZiAocGFydC51c2VCbG9iKSB7XG4gICAgICBwYXJ0LmJvZHkgPSBVdGlsLmJhc2U2NFRvQmxvYihwYXJ0LmJvZHkpO1xuICAgICAgZGVsZXRlIHBhcnQudXNlQmxvYjtcbiAgICAgIHBhcnQuZW5jb2RpbmcgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYW5kIHNvcnRzIHRoZSBtZXNzYWdlIG9iamVjdHMgZnJvbSB0aGUgZGF0YWJhc2UuXG4gICAqXG4gICAqIFRPRE86IEVuY29kZSBsaW1pdHMgb24gdGhpcywgZWxzZSB3ZSBhcmUgc29ydGluZyB0ZW5zIG9mIHRob3VzYW5kc1xuICAgKiBvZiBtZXNzYWdlcyBpbiBqYXZhc2NyaXB0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkTWVzc2FnZXNSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gTWVzc2FnZSBvYmplY3RzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGNhbGxiYWNrLnJlc3VsdCAtIE1lc3NhZ2UgaW5zdGFuY2VzIGNyZWF0ZWQgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gIF9sb2FkTWVzc2FnZXNSZXN1bHQobWVzc2FnZXMsIGNhbGxiYWNrKSB7XG4gICAgLy8gQ29udmVydCBiYXNlNjQgdG8gYmxvYiBiZWZvcmUgc2VuZGluZyBpdCBhbG9uZy4uLlxuICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiBtZXNzYWdlLnBhcnRzLmZvckVhY2gocGFydCA9PiB0aGlzLl9ibG9iaWZ5UGFydChwYXJ0KSkpO1xuXG4gICAgLy8gSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIGVhY2ggTWVzc2FnZVxuICAgIGNvbnN0IG5ld0RhdGEgPSBtZXNzYWdlc1xuICAgICAgLm1hcChtZXNzYWdlID0+IHRoaXMuX2NyZWF0ZU1lc3NhZ2UobWVzc2FnZSkgfHwgdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShtZXNzYWdlLmlkKSlcbiAgICAgIC5maWx0ZXIobWVzc2FnZSA9PiBtZXNzYWdlKTtcblxuICAgIC8vIFJldHVybiB0aGUgcmVzdWx0c1xuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBJZGVudGl0aWVzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRJZGVudGl0aWVzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBsb2FkSWRlbnRpdGllcyhjYWxsYmFjaykge1xuICAgIHRoaXMuX2xvYWRBbGwoJ2lkZW50aXRpZXMnLCAoZGF0YSkgPT4ge1xuICAgICAgdGhpcy5fbG9hZElkZW50aXRpZXNSZXN1bHQoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VtYmxlIGFsbCBMYXN0TWVzc2FnZXMgYW5kIElkZW50aXR5eSBQT0pPcyBpbnRvIGxheWVyLk1lc3NhZ2UgYW5kIGxheWVyLklkZW50aXR5eSBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRJZGVudGl0aWVzUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGlkZW50aXRpZXNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkSWRlbnRpdGllc1Jlc3VsdChpZGVudGl0aWVzLCBjYWxsYmFjaykge1xuICAgIC8vIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciBlYWNoIElkZW50aXR5LlxuICAgIGNvbnN0IG5ld0RhdGEgPSBpZGVudGl0aWVzXG4gICAgICAubWFwKGlkZW50aXR5ID0+IHRoaXMuX2NyZWF0ZUlkZW50aXR5KGlkZW50aXR5KSB8fCB0aGlzLmNsaWVudC5nZXRJZGVudGl0eShpZGVudGl0eS5pZCkpXG4gICAgICAuZmlsdGVyKGlkZW50aXR5ID0+IGlkZW50aXR5KTtcblxuICAgIC8vIFJldHVybiB0aGUgZGF0YVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIHRoZSBDb252ZXJzYXRpb24gZnJvbSBhIGNvbnZlcnNhdGlvbiBEQiBFbnRyeS5cbiAgICpcbiAgICogSWYgdGhlIGxheWVyLkNvbnZlcnNhdGlvbiBhbHJlYWR5IGV4aXN0cywgdGhlbiBpdHMgcHJlc3VtZWQgdGhhdCB3aGF0ZXZlciBpcyBpblxuICAgKiBqYXZhc2NyaXB0IGNhY2hlIGlzIG1vcmUgdXAgdG8gZGF0ZSB0aGFuIHdoYXRzIGluIEluZGV4ZWREQiBjYWNoZS5cbiAgICpcbiAgICogQXR0ZW1wdHMgdG8gYXNzaWduIHRoZSBsYXN0TWVzc2FnZSBwcm9wZXJ0eSB0byByZWZlciB0byBhcHByb3ByaWF0ZSBNZXNzYWdlLiAgSWYgaXQgZmFpbHMsXG4gICAqIGl0IHdpbGwgYmUgc2V0IHRvIG51bGwuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUNvbnZlcnNhdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY29udmVyc2F0aW9uXG4gICAqIEByZXR1cm5zIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBfY3JlYXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgIGlmICghdGhpcy5jbGllbnQuZ2V0Q29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbi5pZCkpIHtcbiAgICAgIGNvbnZlcnNhdGlvbi5fZnJvbURCID0gdHJ1ZTtcbiAgICAgIGNvbnN0IG5ld0NvbnZlcnNhdGlvbiA9IHRoaXMuY2xpZW50Ll9jcmVhdGVPYmplY3QoY29udmVyc2F0aW9uKTtcbiAgICAgIG5ld0NvbnZlcnNhdGlvbi5zeW5jU3RhdGUgPSBjb252ZXJzYXRpb24uc3luY19zdGF0ZTtcbiAgICAgIHJldHVybiBuZXdDb252ZXJzYXRpb247XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciB0aGUgTWVzc2FnZSBmcm9tIGEgbWVzc2FnZSBEQiBFbnRyeS5cbiAgICpcbiAgICogSWYgdGhlIGxheWVyLk1lc3NhZ2UgYWxyZWFkeSBleGlzdHMsIHRoZW4gaXRzIHByZXN1bWVkIHRoYXQgd2hhdGV2ZXIgaXMgaW5cbiAgICogamF2YXNjcmlwdCBjYWNoZSBpcyBtb3JlIHVwIHRvIGRhdGUgdGhhbiB3aGF0cyBpbiBJbmRleGVkREIgY2FjaGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZU1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2VcbiAgICogQHJldHVybnMge2xheWVyLk1lc3NhZ2V9XG4gICAqL1xuICBfY3JlYXRlTWVzc2FnZShtZXNzYWdlKSB7XG4gICAgaWYgKCF0aGlzLmNsaWVudC5nZXRNZXNzYWdlKG1lc3NhZ2UuaWQpKSB7XG4gICAgICBtZXNzYWdlLl9mcm9tREIgPSB0cnVlO1xuICAgICAgbWVzc2FnZS5jb252ZXJzYXRpb24gPSB7IGlkOiBtZXNzYWdlLmNvbnZlcnNhdGlvbiB9O1xuICAgICAgY29uc3QgbmV3TWVzc2FnZSA9IHRoaXMuY2xpZW50Ll9jcmVhdGVPYmplY3QobWVzc2FnZSk7XG4gICAgICBuZXdNZXNzYWdlLnN5bmNTdGF0ZSA9IG1lc3NhZ2Uuc3luY19zdGF0ZTtcbiAgICAgIHJldHVybiBuZXdNZXNzYWdlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnN0YW50aWF0ZSBhbmQgUmVnaXN0ZXIgdGhlIElkZW50aXR5IGZyb20gYW4gaWRlbnRpdGllcyBEQiBFbnRyeS5cbiAgICpcbiAgICogSWYgdGhlIGxheWVyLklkZW50aXR5IGFscmVhZHkgZXhpc3RzLCB0aGVuIGl0cyBwcmVzdW1lZCB0aGF0IHdoYXRldmVyIGlzIGluXG4gICAqIGphdmFzY3JpcHQgY2FjaGUgaXMgbW9yZSB1cCB0byBkYXRlIHRoYW4gd2hhdHMgaW4gSW5kZXhlZERCIGNhY2hlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVJZGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gaWRlbnRpdHlcbiAgICogQHJldHVybnMge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgX2NyZWF0ZUlkZW50aXR5KGlkZW50aXR5KSB7XG4gICAgaWYgKCF0aGlzLmNsaWVudC5nZXRJZGVudGl0eShpZGVudGl0eS5pZCkpIHtcbiAgICAgIGlkZW50aXR5Ll9mcm9tREIgPSB0cnVlO1xuICAgICAgY29uc3QgbmV3aWRlbnRpdHkgPSB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KGlkZW50aXR5KTtcbiAgICAgIG5ld2lkZW50aXR5LnN5bmNTdGF0ZSA9IGlkZW50aXR5LnN5bmNfc3RhdGU7XG4gICAgICByZXR1cm4gbmV3aWRlbnRpdHk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYWxsIFN5bmMgRXZlbnRzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRTeW5jUXVldWVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnRbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBsb2FkU3luY1F1ZXVlKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fbG9hZEFsbCgnc3luY1F1ZXVlJywgc3luY0V2ZW50cyA9PiB0aGlzLl9sb2FkU3luY0V2ZW50UmVsYXRlZERhdGEoc3luY0V2ZW50cywgY2FsbGJhY2spKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGF0IHdlIGhhdmUgYXBwcm9wcmlhdGUgZGF0YSBmb3IgZWFjaCBTeW5jRXZlbnQgYW5kIGluc3RhbnRpYXRlIGl0LlxuICAgKlxuICAgKiBBbnkgb3BlcmF0aW9uIHRoYXQgaXMgbm90IGEgREVMRVRFIG11c3QgaGF2ZSBhIHZhbGlkIHRhcmdldCBmb3VuZCBpbiB0aGUgZGF0YWJhc2Ugb3IgamF2YXNjcmlwdCBjYWNoZSxcbiAgICogb3RoZXJ3aXNlIGl0IGNhbiBub3QgYmUgZXhlY3V0ZWQuXG4gICAqXG4gICAqIFRPRE86IE5lZWQgdG8gY2xlYW51cCBzeW5jIGVudHJpZXMgdGhhdCBoYXZlIGludmFsaWQgdGFyZ2V0c1xuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkU3luY0V2ZW50UmVsYXRlZERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gc3luY0V2ZW50c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkU3luY0V2ZW50UmVsYXRlZERhdGEoc3luY0V2ZW50cywgY2FsbGJhY2spIHtcbiAgICAvLyBHYXRoZXIgYWxsIE1lc3NhZ2UgSURzIHRoYXQgYXJlIHRhcmdldHMgb2Ygb3BlcmF0aW9ucy5cbiAgICBjb25zdCBtZXNzYWdlSWRzID0gc3luY0V2ZW50c1xuICAgICAgLmZpbHRlcihpdGVtID0+IGl0ZW0ub3BlcmF0aW9uICE9PSAnREVMRVRFJyAmJiBpdGVtLnRhcmdldCAmJiBpdGVtLnRhcmdldC5tYXRjaCgvbWVzc2FnZXMvKSlcbiAgICAgIC5tYXAoaXRlbSA9PiBpdGVtLnRhcmdldCk7XG5cbiAgICAvLyBHYXRoZXIgYWxsIENvbnZlcnNhdGlvbiBJRHMgdGhhdCBhcmUgdGFyZ2V0cyBvZiBvcGVyYXRpb25zLlxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkcyA9IHN5bmNFdmVudHNcbiAgICAgIC5maWx0ZXIoaXRlbSA9PiBpdGVtLm9wZXJhdGlvbiAhPT0gJ0RFTEVURScgJiYgaXRlbS50YXJnZXQgJiYgaXRlbS50YXJnZXQubWF0Y2goL2NvbnZlcnNhdGlvbnMvKSlcbiAgICAgIC5tYXAoaXRlbSA9PiBpdGVtLnRhcmdldCk7XG5cbiAgICBjb25zdCBpZGVudGl0eUlkcyA9IHN5bmNFdmVudHNcbiAgICAgIC5maWx0ZXIoaXRlbSA9PiBpdGVtLm9wZXJhdGlvbiAhPT0gJ0RFTEVURScgJiYgaXRlbS50YXJnZXQgJiYgaXRlbS50YXJnZXQubWF0Y2goL2lkZW50aXRpZXMvKSlcbiAgICAgIC5tYXAoaXRlbSA9PiBpdGVtLnRhcmdldCk7XG5cbiAgICAvLyBMb2FkIGFueSBNZXNzYWdlcy9Db252ZXJzYXRpb25zIHRoYXQgYXJlIHRhcmdldHMgb2Ygb3BlcmF0aW9ucy5cbiAgICAvLyBDYWxsIF9jcmVhdGVNZXNzYWdlIG9yIF9jcmVhdGVDb252ZXJzYXRpb24gb24gYWxsIHRhcmdldHMgZm91bmQuXG4gICAgbGV0IGNvdW50ZXIgPSAwO1xuICAgIGNvbnN0IG1heENvdW50ZXIgPSAzO1xuICAgIHRoaXMuZ2V0T2JqZWN0cygnbWVzc2FnZXMnLCBtZXNzYWdlSWRzLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB0aGlzLl9jcmVhdGVNZXNzYWdlKG1lc3NhZ2UpKTtcbiAgICAgIGNvdW50ZXIrKztcbiAgICAgIGlmIChjb3VudGVyID09PSBtYXhDb3VudGVyKSB0aGlzLl9sb2FkU3luY0V2ZW50UmVzdWx0cyhzeW5jRXZlbnRzLCBjYWxsYmFjayk7XG4gICAgfSk7XG4gICAgdGhpcy5nZXRPYmplY3RzKCdjb252ZXJzYXRpb25zJywgY29udmVyc2F0aW9uSWRzLCAoY29udmVyc2F0aW9ucykgPT4ge1xuICAgICAgY29udmVyc2F0aW9ucy5mb3JFYWNoKGNvbnZlcnNhdGlvbiA9PiB0aGlzLl9jcmVhdGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uKSk7XG4gICAgICBjb3VudGVyKys7XG4gICAgICBpZiAoY291bnRlciA9PT0gbWF4Q291bnRlcikgdGhpcy5fbG9hZFN5bmNFdmVudFJlc3VsdHMoc3luY0V2ZW50cywgY2FsbGJhY2spO1xuICAgIH0pO1xuICAgIHRoaXMuZ2V0T2JqZWN0cygnaWRlbnRpdGllcycsIGlkZW50aXR5SWRzLCAoaWRlbnRpdGllcykgPT4ge1xuICAgICAgaWRlbnRpdGllcy5mb3JFYWNoKGlkZW50aXR5ID0+IHRoaXMuX2NyZWF0ZUlkZW50aXR5KGlkZW50aXR5KSk7XG4gICAgICBjb3VudGVyKys7XG4gICAgICBpZiAoY291bnRlciA9PT0gbWF4Q291bnRlcikgdGhpcy5fbG9hZFN5bmNFdmVudFJlc3VsdHMoc3luY0V2ZW50cywgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFR1cm4gYW4gYXJyYXkgb2YgU3luYyBFdmVudCBEQiBFbnRyaWVzIGludG8gYW4gYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkU3luY0V2ZW50UmVzdWx0c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdFtdfSBzeW5jRXZlbnRzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgX2xvYWRTeW5jRXZlbnRSZXN1bHRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKSB7XG4gICAgLy8gSWYgdGhlIHRhcmdldCBpcyBwcmVzZW50IGluIHRoZSBzeW5jIGV2ZW50LCBidXQgZG9lcyBub3QgZXhpc3QgaW4gdGhlIHN5c3RlbSxcbiAgICAvLyBkbyBOT1QgYXR0ZW1wdCB0byBpbnN0YW50aWF0ZSB0aGlzIGV2ZW50Li4uIHVubGVzcyBpdHMgYSBERUxFVEUgb3BlcmF0aW9uLlxuICAgIGNvbnN0IG5ld0RhdGEgPSBzeW5jRXZlbnRzXG4gICAgLmZpbHRlcigoc3luY0V2ZW50KSA9PiB7XG4gICAgICBjb25zdCBoYXNUYXJnZXQgPSBCb29sZWFuKHN5bmNFdmVudC50YXJnZXQgJiYgdGhpcy5jbGllbnQuX2dldE9iamVjdChzeW5jRXZlbnQudGFyZ2V0KSk7XG4gICAgICByZXR1cm4gc3luY0V2ZW50Lm9wZXJhdGlvbiA9PT0gJ0RFTEVURScgfHwgaGFzVGFyZ2V0O1xuICAgIH0pXG4gICAgLm1hcCgoc3luY0V2ZW50KSA9PiB7XG4gICAgICBpZiAoc3luY0V2ZW50LmlzV2Vic29ja2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgU3luY0V2ZW50LldlYnNvY2tldFN5bmNFdmVudCh7XG4gICAgICAgICAgdGFyZ2V0OiBzeW5jRXZlbnQudGFyZ2V0LFxuICAgICAgICAgIGRlcGVuZHM6IHN5bmNFdmVudC5kZXBlbmRzLFxuICAgICAgICAgIG9wZXJhdGlvbjogc3luY0V2ZW50Lm9wZXJhdGlvbixcbiAgICAgICAgICBpZDogc3luY0V2ZW50LmlkLFxuICAgICAgICAgIGRhdGE6IHN5bmNFdmVudC5kYXRhLFxuICAgICAgICAgIGZyb21EQjogdHJ1ZSxcbiAgICAgICAgICBjcmVhdGVkQXQ6IHN5bmNFdmVudC5jcmVhdGVkX2F0LFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgU3luY0V2ZW50LlhIUlN5bmNFdmVudCh7XG4gICAgICAgICAgdGFyZ2V0OiBzeW5jRXZlbnQudGFyZ2V0LFxuICAgICAgICAgIGRlcGVuZHM6IHN5bmNFdmVudC5kZXBlbmRzLFxuICAgICAgICAgIG9wZXJhdGlvbjogc3luY0V2ZW50Lm9wZXJhdGlvbixcbiAgICAgICAgICBpZDogc3luY0V2ZW50LmlkLFxuICAgICAgICAgIGRhdGE6IHN5bmNFdmVudC5kYXRhLFxuICAgICAgICAgIG1ldGhvZDogc3luY0V2ZW50Lm1ldGhvZCxcbiAgICAgICAgICBoZWFkZXJzOiBzeW5jRXZlbnQuaGVhZGVycyxcbiAgICAgICAgICB1cmw6IHN5bmNFdmVudC51cmwsXG4gICAgICAgICAgZnJvbURCOiB0cnVlLFxuICAgICAgICAgIGNyZWF0ZWRBdDogc3luY0V2ZW50LmNyZWF0ZWRfYXQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU29ydCB0aGUgcmVzdWx0cyBhbmQgdGhlbiByZXR1cm4gdGhlbS5cbiAgICAvLyBUT0RPOiBRdWVyeSByZXN1bHRzIHNob3VsZCBjb21lIGJhY2sgc29ydGVkIGJ5IGRhdGFiYXNlIHdpdGggcHJvcGVyIEluZGV4XG4gICAgVXRpbC5zb3J0QnkobmV3RGF0YSwgaXRlbSA9PiBpdGVtLmNyZWF0ZWRBdCk7XG4gICAgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgZGF0YSBmcm9tIHRoZSBzcGVjaWZpZWQgdGFibGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRBbGxcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFibGVOYW1lXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgX2xvYWRBbGwodGFibGVOYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IFtdO1xuICAgICAgdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWRvbmx5Jykub2JqZWN0U3RvcmUodGFibGVOYW1lKS5vcGVuQ3Vyc29yKCkub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJzb3IgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgaWYgKGN1cnNvcikge1xuICAgICAgICAgIGRhdGEucHVzaChjdXJzb3IudmFsdWUpO1xuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSB7XG4gICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgZGF0YSBmcm9tIHRoZSBzcGVjaWZpZWQgdGFibGUgYW5kIHdpdGggdGhlIHNwZWNpZmllZCBpbmRleCB2YWx1ZS5cbiAgICpcbiAgICogUmVzdWx0cyBhcmUgYWx3YXlzIHNvcnRlZCBpbiBERVNDIG9yZGVyIGF0IHRoaXMgdGltZS5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZEJ5SW5kZXhcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFibGVOYW1lIC0gJ21lc3NhZ2VzJywgJ2NvbnZlcnNhdGlvbnMnLCAnaWRlbnRpdGllcydcbiAgICogQHBhcmFtIHtTdHJpbmd9IGluZGV4TmFtZSAtIE5hbWUgb2YgdGhlIGluZGV4IHRvIHF1ZXJ5IG9uXG4gICAqIEBwYXJhbSB7SURCS2V5UmFuZ2V9IHJhbmdlIC0gUmFuZ2UgdG8gUXVlcnkgZm9yIChudWxsIG9rKVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGlzRnJvbUlkIC0gSWYgcXVlcnlpbmcgZm9yIHJlc3VsdHMgYWZ0ZXIgYSBzcGVjaWZpZWQgSUQsIHRoZW4gd2Ugd2FudCB0byBza2lwIHRoZSBmaXJzdCByZXN1bHQgKHdoaWNoIHdpbGwgYmUgdGhhdCBJRCkgKFwiXCIgaXMgT0spXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBwYWdlU2l6ZSAtIElmIGEgdmFsdWUgaXMgcHJvdmlkZWQsIHJldHVybiBhdCBtb3N0IHRoYXQgbnVtYmVyIG9mIHJlc3VsdHM7IGVsc2UgcmV0dXJuIGFsbCByZXN1bHRzLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge09iamVjdFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkQnlJbmRleCh0YWJsZU5hbWUsIGluZGV4TmFtZSwgcmFuZ2UsIGlzRnJvbUlkLCBwYWdlU2l6ZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZU5hbWVdIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2soW10pO1xuICAgIGxldCBzaG91bGRTa2lwTmV4dCA9IGlzRnJvbUlkO1xuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBbXTtcbiAgICAgIHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkb25seScpXG4gICAgICAgICAgLm9iamVjdFN0b3JlKHRhYmxlTmFtZSlcbiAgICAgICAgICAuaW5kZXgoaW5kZXhOYW1lKVxuICAgICAgICAgIC5vcGVuQ3Vyc29yKHJhbmdlLCAncHJldicpXG4gICAgICAgICAgLm9uc3VjY2VzcyA9IChldnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnNvciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgaWYgKGN1cnNvcikge1xuICAgICAgICAgICAgICBpZiAoc2hvdWxkU2tpcE5leHQpIHtcbiAgICAgICAgICAgICAgICBzaG91bGRTa2lwTmV4dCA9IGZhbHNlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRhdGEucHVzaChjdXJzb3IudmFsdWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChwYWdlU2l6ZSAmJiBkYXRhLmxlbmd0aCA+PSBwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyB0aGUgc3BlY2lmaWVkIG9iamVjdHMgZnJvbSB0aGUgc3BlY2lmaWVkIHRhYmxlLlxuICAgKlxuICAgKiBDdXJyZW50bHkgdGFrZXMgYW4gYXJyYXkgb2YgZGF0YSB0byBkZWxldGUgcmF0aGVyIHRoYW4gYW4gYXJyYXkgb2YgSURzO1xuICAgKiBJZiB5b3Ugb25seSBoYXZlIGFuIElELCBbe2lkOiBteUlkfV0gc2hvdWxkIHdvcmsuXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlT2JqZWN0c1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFibGVOYW1lXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGRhdGFcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgZGVsZXRlT2JqZWN0cyh0YWJsZU5hbWUsIGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzWydfcGVybWlzc2lvbl8nICsgdGFibGVOYW1lXSB8fCB0aGlzLl9pc09wZW5FcnJvcikgcmV0dXJuIGNhbGxiYWNrID8gY2FsbGJhY2soKSA6IG51bGw7XG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSB0aGlzLmRiLnRyYW5zYWN0aW9uKFt0YWJsZU5hbWVdLCAncmVhZHdyaXRlJyk7XG4gICAgICBjb25zdCBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHRhYmxlTmFtZSk7XG4gICAgICB0cmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gY2FsbGJhY2s7XG4gICAgICBkYXRhLmZvckVhY2goaXRlbSA9PiBzdG9yZS5kZWxldGUoaXRlbS5pZCkpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBpZGVudGlmaWVkIG9iamVjdHMgZnJvbSB0aGUgc3BlY2lmaWVkIGRhdGFiYXNlIHRhYmxlLlxuICAgKlxuICAgKiBUdXJuaW5nIHRoZXNlIGludG8gaW5zdGFuY2VzIGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY2FsbGVyLlxuICAgKlxuICAgKiBJbnNwaXJlZCBieSBodHRwOi8vd3d3LmNvZGVwcm9qZWN0LmNvbS9BcnRpY2xlcy83NDQ5ODYvSG93LXRvLWRvLXNvbWUtbWFnaWMtd2l0aC1pbmRleGVkREJcbiAgICpcbiAgICogQG1ldGhvZCBnZXRPYmplY3RzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWJsZU5hbWVcbiAgICogQHBhcmFtIHtTdHJpbmdbXX0gaWRzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgZ2V0T2JqZWN0cyh0YWJsZU5hbWUsIGlkcywgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZU5hbWVdIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2soW10pO1xuICAgIGNvbnN0IGRhdGEgPSBbXTtcblxuICAgIC8vIEdhdGhlciwgc29ydCwgYW5kIGZpbHRlciByZXBsaWNhIElEc1xuICAgIGNvbnN0IHNvcnRlZElkcyA9IGlkcy5zb3J0KCk7XG4gICAgZm9yIChsZXQgaSA9IHNvcnRlZElkcy5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICBpZiAoc29ydGVkSWRzW2ldID09PSBzb3J0ZWRJZHNbaSAtIDFdKSBzb3J0ZWRJZHMuc3BsaWNlKGksIDEpO1xuICAgIH1cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIHRoZSB0YWJsZSBzZWFyY2hpbmcgZm9yIHRoZSBzcGVjaWZpZWQgSURzXG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWRvbmx5JylcbiAgICAgICAgLm9iamVjdFN0b3JlKHRhYmxlTmFtZSlcbiAgICAgICAgLm9wZW5DdXJzb3IoKS5vbnN1Y2Nlc3MgPSAoZXZ0KSA9PiB7XG4gICAgICAgICAgY29uc3QgY3Vyc29yID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBrZXkgPSBjdXJzb3Iua2V5O1xuXG4gICAgICAgICAgLy8gVGhlIGN1cnNvciBoYXMgcGFzc2VkIGJleW9uZCB0aGlzIGtleS4gQ2hlY2sgbmV4dC5cbiAgICAgICAgICB3aGlsZSAoa2V5ID4gc29ydGVkSWRzW2luZGV4XSkgaW5kZXgrKztcblxuICAgICAgICAgIC8vIFRoZSBjdXJzb3IgaXMgcG9pbnRpbmcgYXQgb25lIG9mIG91ciBJRHMsIGdldCBpdCBhbmQgY2hlY2sgbmV4dC5cbiAgICAgICAgICBpZiAoa2V5ID09PSBzb3J0ZWRJZHNbaW5kZXhdKSB7XG4gICAgICAgICAgICBkYXRhLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uZSBvciBjaGVjayBuZXh0XG4gICAgICAgICAgaWYgKGluZGV4ID09PSBzb3J0ZWRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNEZXN0cm95ZWQpIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdXJzb3IuY29udGludWUoc29ydGVkSWRzW2luZGV4XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgc2ltcGxpZmllZCBnZXRPYmplY3RzKCkgbWV0aG9kIHRoYXQgZ2V0cyBhIHNpbmdsZSBvYmplY3QsIGFuZCBhbHNvIGdldHMgaXRzIHJlbGF0ZWQgb2JqZWN0cy5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRPYmplY3RcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRhYmxlTmFtZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtPYmplY3R9IGNhbGxiYWNrLmRhdGFcbiAgICovXG4gIGdldE9iamVjdCh0YWJsZU5hbWUsIGlkLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjaygpO1xuXG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWRvbmx5JylcbiAgICAgICAgLm9iamVjdFN0b3JlKHRhYmxlTmFtZSlcbiAgICAgICAgLm9wZW5DdXJzb3Iod2luZG93LklEQktleVJhbmdlLm9ubHkoaWQpKS5vbnN1Y2Nlc3MgPSAoZXZ0KSA9PiB7XG4gICAgICAgICAgY29uc3QgY3Vyc29yID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHJldHVybiBjYWxsYmFjayhudWxsKTtcblxuICAgICAgICAgIHN3aXRjaCAodGFibGVOYW1lKSB7XG4gICAgICAgICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICAgICAgICAgIGN1cnNvci52YWx1ZS5jb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgaWQ6IGN1cnNvci52YWx1ZS5jb252ZXJzYXRpb24sXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIC8vIENvbnZlcnQgYmFzZTY0IHRvIGJsb2IgYmVmb3JlIHNlbmRpbmcgaXQgYWxvbmcuLi5cbiAgICAgICAgICAgICAgY3Vyc29yLnZhbHVlLnBhcnRzLmZvckVhY2gocGFydCA9PiB0aGlzLl9ibG9iaWZ5UGFydChwYXJ0KSk7XG4gICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjdXJzb3IudmFsdWUpO1xuICAgICAgICAgICAgY2FzZSAnaWRlbnRpdGllcyc6XG4gICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjdXJzb3IudmFsdWUpO1xuICAgICAgICAgICAgY2FzZSAnY29udmVyc2F0aW9ucyc6XG4gICAgICAgICAgICAgIGlmIChjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlICYmICF0aGlzLmNsaWVudC5nZXRNZXNzYWdlKGN1cnNvci52YWx1ZS5sYXN0X21lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0T2JqZWN0KCdtZXNzYWdlcycsIGN1cnNvci52YWx1ZS5sYXN0X21lc3NhZ2UsIChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGN1cnNvci52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGN1cnNvci52YWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xhaW0gYSBTeW5jIEV2ZW50LlxuICAgKlxuICAgKiBBIHN5bmMgZXZlbnQgaXMgY2xhaW1lZCBieSBsb2NraW5nIHRoZSB0YWJsZSwgIHZhbGlkYXRpbmcgdGhhdCBpdCBpcyBzdGlsbCBpbiB0aGUgdGFibGUuLi4gYW5kIHRoZW4gZGVsZXRpbmcgaXQgZnJvbSB0aGUgdGFibGUuXG4gICAqXG4gICAqIEBtZXRob2QgY2xhaW1TeW5jRXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHN5bmNFdmVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgY2xhaW1TeW5jRXZlbnQoc3luY0V2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpcy5fcGVybWlzc2lvbl9zeW5jUXVldWUgfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayh0cnVlKTtcbiAgICB0aGlzLm9uT3BlbigoKSA9PiB7XG4gICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IHRoaXMuZGIudHJhbnNhY3Rpb24oWydzeW5jUXVldWUnXSwgJ3JlYWR3cml0ZScpO1xuICAgICAgY29uc3Qgc3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZSgnc3luY1F1ZXVlJyk7XG4gICAgICBzdG9yZS5nZXQoc3luY0V2ZW50LmlkKS5vbnN1Y2Nlc3MgPSBldnQgPT4gY2FsbGJhY2soQm9vbGVhbihldnQudGFyZ2V0LnJlc3VsdCkpO1xuICAgICAgc3RvcmUuZGVsZXRlKHN5bmNFdmVudC5pZCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGFsbCBkYXRhIGZyb20gYWxsIHRhYmxlcy5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYmUgY2FsbGVkIGZyb20gbGF5ZXIuQ2xpZW50LmxvZ291dCgpXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlVGFibGVzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsbGJhY2tdXG4gICAqL1xuICBkZWxldGVUYWJsZXMoY2FsbGJhY2sgPSBmdW5jdGlvbigpIHt9KSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciByZXF1ZXN0ID0gd2luZG93LmluZGV4ZWREQi5kZWxldGVEYXRhYmFzZSh0aGlzLl9nZXREYk5hbWUoKSk7XG4gICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IHJlcXVlc3Qub25lcnJvciA9IGNhbGxiYWNrO1xuICAgICAgZGVsZXRlIHRoaXMuZGI7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gZGVsZXRlIGRhdGFiYXNlJywgZSk7XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGUpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEB0eXBlIHtsYXllci5DbGllbnR9IExheWVyIENsaWVudCBpbnN0YW5jZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogQHR5cGUge2Jvb2xlYW59IGlzIHRoZSBkYiBjb25uZWN0aW9uIG9wZW5cbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5pc09wZW4gPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gaXMgdGhlIGRiIGNvbm5lY3Rpb24gd2lsbCBub3Qgb3BlblxuICogQHByaXZhdGVcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5faXNPcGVuRXJyb3IgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gSXMgcmVhZGluZy93cml0aW5nIG1lc3NhZ2VzIGFsbG93ZWQ/XG4gKiBAcHJpdmF0ZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLl9wZXJtaXNzaW9uX21lc3NhZ2VzID0gZmFsc2U7XG5cbi8qKlxuICogQHR5cGUge2Jvb2xlYW59IElzIHJlYWRpbmcvd3JpdGluZyBjb252ZXJzYXRpb25zIGFsbG93ZWQ/XG4gKiBAcHJpdmF0ZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLl9wZXJtaXNzaW9uX2NvbnZlcnNhdGlvbnMgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gSXMgcmVhZGluZy93cml0aW5nIGlkZW50aXRpZXMgYWxsb3dlZD9cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX3Blcm1pc3Npb25faWRlbnRpdGllcyA9IGZhbHNlO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBJcyByZWFkaW5nL3dyaXRpbmcgdW5zZW50IHNlcnZlciByZXF1ZXN0cyBhbGxvd2VkP1xuICogQHByaXZhdGVcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5fcGVybWlzc2lvbl9zeW5jUXVldWUgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSBJREJEYXRhYmFzZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLmRiID0gbnVsbDtcblxuLyoqXG4gKiBSaWNoIENvbnRlbnQgbWF5IGJlIHdyaXR0ZW4gdG8gaW5kZXhlZGRiIGFuZCBwZXJzaXN0ZWQuLi4gaWYgaXRzIHNpemUgaXMgbGVzcyB0aGFuIHRoaXMgbnVtYmVyIG9mIGJ5dGVzLlxuICpcbiAqIFRoaXMgdmFsdWUgY2FuIGJlIGN1c3RvbWl6ZWQ7IHRoaXMgZXhhbXBsZSBvbmx5IHdyaXRlcyBSaWNoIENvbnRlbnQgdGhhdCBpcyBsZXNzIHRoYW4gNTAwMCBieXRlc1xuICpcbiAqICAgIGxheWVyLkRiTWFuYWdlci5NYXhQYXJ0U2l6ZSA9IDUwMDA7XG4gKlxuICogQHN0YXRpY1xuICogQHR5cGUge051bWJlcn1cbiAqL1xuRGJNYW5hZ2VyLk1heFBhcnRTaXplID0gMjUwMDAwO1xuXG5EYk1hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgJ29wZW4nLCAnZXJyb3InLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoRGJNYW5hZ2VyLCBbRGJNYW5hZ2VyLCAnRGJNYW5hZ2VyJ10pO1xubW9kdWxlLmV4cG9ydHMgPSBEYk1hbmFnZXI7XG4iXX0=
