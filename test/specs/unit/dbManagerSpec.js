/*eslint-disable */

describe("The DbManager Class", function() {
    var appId = "Fred's App";
    var userId = "Frodo";
    var client,
        conversation,
        message,
        announcement,
        dbManager;

        var MAX_SAFE_INTEGER = 9007199254740991;

    function deleteTables(done) {
      client.dbManager._loadAll('messages', function(results) {
        client.dbManager.deleteObjects('messages', results, function() {
          client.dbManager._loadAll('conversations', function(results) {
            client.dbManager.deleteObjects('conversations', results, function() {
              setTimeout(done, 100);
            });
          });
        });
      });
    }


    beforeEach(function(done) {
        client = new layer.Client({
            appId: appId,
            url: "https://huh.com",
            isTrustedDevice: true,
            isPersistenceEnabled: true
        });
        client.sessionToken = "sessionToken";

        client.user = {userId: userId};
        client._clientAuthenticated();
        client._clientReady();
        client.syncManager.queue = [];
        conversation = client._createObject(responses.conversation1);
        message = conversation.lastMessage;
        announcement = client._createObject(responses.announcement);

        dbManager = client.dbManager;
        deleteTables(function() {
          done();
        });
    });

    afterEach(function() {
        client.destroy();
    });

    describe("The constructor() method", function() {
      it("Should listen for conversations:add events", function() {
        spyOn(dbManager, "writeConversations");
        client.trigger('conversations:add', { conversations: [conversation] });
        expect(dbManager.writeConversations).toHaveBeenCalledWith([conversation], false);
      });

      it("Should listen for conversations:change events", function() {
        spyOn(dbManager, "writeConversations");
        client.trigger('conversations:change', {
          target: conversation,
          oldValue: 1,
          newValue: 2,
          property: 'unreadCount'
        });
        expect(dbManager.writeConversations).toHaveBeenCalledWith([conversation], true);
      });

      it("Should listen for conversations:delete events", function() {
        spyOn(dbManager, "deleteObjects");
        client.trigger('conversations:delete', { target: conversation });
        expect(dbManager.deleteObjects).toHaveBeenCalledWith('conversations', [conversation]);
      });

      it("Should listen for messages:add events", function() {
        spyOn(dbManager, "writeMessages");
        client.trigger('messages:add', { messages: [message] });
        expect(dbManager.writeMessages).toHaveBeenCalledWith([message], false);
      });

      it("Should listen for messages:change events", function() {
        spyOn(dbManager, "writeMessages");
        client.trigger('messages:change', {
          target: message,
          oldValue: 1,
          newValue: 2,
          property: 'unreadCount'
        });
        expect(dbManager.writeMessages).toHaveBeenCalledWith([message], true);
      });

      it("Should listen for messages:delete events", function() {
        spyOn(dbManager, "deleteObjects");
        client.trigger('messages:delete', { target: message });
        expect(dbManager.deleteObjects).toHaveBeenCalledWith('messages', [message]);
      });

      it("Should call _open", function() {
        var _open = layer.DbManager.prototype._open;
        spyOn(layer.DbManager.prototype, "_open");
        var dbManager = new layer.DbManager({
          client: client,
          tables: {conversations: true}
         });

        // Posttest
        expect(layer.DbManager.prototype._open).toHaveBeenCalledWith();

        // Cleanup
        layer.DbManager.prototype._open = _open;
      });

      it("Should accept a tables property", function() {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {
            conversations: true,
            messages: true,
            syncQueue: true
          }
        });
        expect(dbManager._permission_conversations).toBe(true);
        expect(dbManager._permission_messages).toBe(true);
        expect(dbManager._permission_syncQueue).toBe(true);
      });

      it("Should set syncQueue to false if either conversations or messages are false", function() {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {
            conversations: true,
            messages: false,
            syncQueue: true
          }
        });
        expect(dbManager._permission_conversations).toBe(true);
        expect(dbManager._permission_messages).toBe(false);
        expect(dbManager._permission_syncQueue).toBe(false);

      });
    });

    describe("The _open() method", function() {
      it("Should callback immediately if no tables enabled", function() {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {
            conversations: false,
            messages: false,
            syncQueue: false
          }
        });
        var done = false;
        dbManager.onOpen(function() {
          done = true;
        });
        expect(done).toBe(true);
      });
      it("Should trigger open event", function(done) {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {conversations: true}
         });
        dbManager.on('open', function() {
          expect(dbManager.isOpen).toBe(true);
          expect(dbManager.db).not.toEqual(null);
          done();
        });
      });

      xit("Should call _onUpgradeNeeded", function() {

      });
    });

    describe("The onOpen() method", function() {
      it("Should callback when open", function(done) {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {conversations: true}
         });
         dbManager.onOpen(function() {
          expect(dbManager.isOpen).toBe(true);
          done();
        });
      });

      it("Should callback immediately if open", function() {
        var spy = jasmine.createSpy('opOpen');
        var dbManager = new layer.DbManager({
          client: client,
          tables: {conversations: true}
         });
        dbManager.isOpen = true;
        dbManager.onOpen(spy);
        expect(spy).toHaveBeenCalledWith();
      });
    });

    xdescribe("The _onUpgradeNeeded() method", function() {

    });

    describe("The _getConversationData() method", function() {
      it("Should ignore anything that just came out of the database and clear _fromDB", function() {
        conversation._fromDB = true;
        expect(dbManager._getConversationData([conversation])).toEqual([]);
        expect(conversation._fromDB).toBe(false);
      });

      it("Should ignore loading Conversations", function() {
        conversation.syncState = layer.Constants.SYNC_STATE.LOADING;
        expect(dbManager._getConversationData([conversation])).toEqual([]);
      });

      it("Should ignore SYNC-NEW Conversations", function() {
        conversation.syncState = layer.Constants.SYNC_STATE.NEW;
        expect(dbManager._getConversationData([conversation])).toEqual([]);
      });

      it("Should generate a proper object", function() {
        expect(dbManager._getConversationData([conversation])).toEqual([{
          id: conversation.id,
          url: conversation.url,
          participants: conversation.participants,
          distinct: conversation.distinct,
          created_at: conversation.createdAt.toISOString(),
          metadata: conversation.metadata,
          unread_message_count: conversation.unreadCount,
          last_message: conversation.lastMessage.id,
          last_message_sent: conversation.lastMessage.sentAt.toISOString(),
          sync_state: conversation.syncState
        }]);
      });
    });

    describe("The writeConversations() method", function() {
      it("Should forward isUpdate true to writeMessages", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getConversationData").and.returnValue([{id: 'fred'}]);
        dbManager.writeConversations([conversation], false);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('conversations', [jasmine.any(Object)], false, undefined);
      });

      it("Should forward isUpdate true to writeMessages", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getConversationData").and.returnValue([{id: 'fred'}]);
        dbManager.writeConversations([conversation], true);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('conversations', [jasmine.any(Object)], true, undefined);
      });

      it("Should feed data from _getConversationData to _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getConversationData").and.returnValue([{id: 'fred'}]);
        dbManager.writeConversations([conversation], false);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('conversations', [{id: 'fred'}], jasmine.any(Boolean), undefined);
      });
    });

    describe("The _getMessageData() method", function() {
      it("Should ignore anything that just came out of the database and clear _fromDB", function() {
        message._fromDB = true;
        var isDone = false;
        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([]);
          expect(message._fromDB).toBe(false);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should ignore loading messages", function() {
        message.syncState = layer.Constants.SYNC_STATE.LOADING;
        var isDone = false;

        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([]);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should generate a proper Message object", function() {
        message = conversation.createMessage("hey ho");
        message.receivedAt = new Date();
        message.sender.displayName = "display name";
        message.sender.avatarUrl = "http://doh";
        var isDone = false;
        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([{
            id: message.id,
            url: message.url,
            position: message.position,
            recipient_status: message.recipientStatus,
            sent_at: message.sentAt.toISOString(),
            received_at: message.receivedAt.toISOString(),
            conversation: message.conversationId,
            is_unread: false,
            sender: {
              user_id: message.sender.userId || '',
              display_name: message.sender.displayName,
              avatar_url: message.sender.avatarUrl,
              name: message.sender.name
            },
            sync_state: message.syncState,
            parts: [{
              id: message.parts[0].id,
              body: message.parts[0].body,
              encoding: message.parts[0].encoding,
              mime_type: message.parts[0].mimeType,
              content: null
            }]
          }]);
          expect(message.sender.displayName.length > 0).toBe(true);
          expect(message.sender.avatarUrl.length > 0).toBe(true);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should generate a proper Announcement object", function() {
        message = client._createObject(JSON.parse(JSON.stringify(responses.announcement)));
        message.receivedAt = new Date();
        message.sender = {
          name: "Hey Ho",
          userId: '',
          displayName: '',
          avatarUrl: ''
        };
        var isDone = false;

        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([{
            id: message.id,
            url: message.url,
            position: message.position,
            recipient_status: message.recipientStatus,
            sent_at: message.sentAt.toISOString(),
            received_at: message.receivedAt.toISOString(),
            is_unread: true,
            conversation: 'announcement',
            sender: {
              name: 'Hey Ho',
              user_id: '',
              display_name: '',
              avatar_url: ''
            },
            sync_state: message.syncState,
            parts: [{
              id: message.parts[0].id,
              body: message.parts[0].body,
              encoding: message.parts[0].encoding,
              mime_type: message.parts[0].mimeType,
              content: null
            }]
          }]);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      // Tests won't run on server due to no Blob support
      it("Should write small Blobs as base64 data", function(done) {
        // Setup
        var text = new Array(1000).join('a');
        var blob = new Blob([text], {type : 'unknown/unhandlable'});
        var message = conversation.createMessage({
          parts: [new layer.MessagePart(blob), new layer.MessagePart(blob)]
        });
        message.receivedAt = new Date();

        // Run
        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([{
            id: message.id,
            url: message.url,
            position: message.position,
            recipient_status: message.recipientStatus,
            sent_at: message.sentAt.toISOString(),
            received_at: message.receivedAt.toISOString(),
            conversation: message.conversationId,
            is_unread: false,
            sender: {
              user_id: message.sender.userId || '',
              display_name: message.sender.displayName,
              avatar_url: message.sender.avatarUrl,
              name: message.sender.name,
            },
            sync_state: message.syncState,
            parts: [{
              id: message.parts[0].id,
              body: jasmine.any(String),
              encoding: message.parts[0].encoding,
              mime_type: message.parts[0].mimeType,
              useBlob: true,
              content: null
            },
            {
              id: message.parts[1].id,
              body: jasmine.any(String),
              encoding: message.parts[1].encoding,
              mime_type: message.parts[1].mimeType,
              useBlob: true,
              content: null
            }]
          }]);

          expect(result[0].parts[0].body.length > 500).toBe(true);
          expect(result[0].parts[1].body.length > 500).toBe(true);
          done();
        });
      });

      it("Should not write large Blobs", function() {
        // Setup
        var text = new Array(layer.DbManager.MaxPartSize + 10).join('a');
        var blob = new Blob([text], {type : 'unknown/unhandlable'});
        var message = conversation.createMessage({
          parts: [new layer.MessagePart(blob)]
        });
        message.receivedAt = new Date();
        var isDone = false;

        // Run
        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([{
            id: message.id,
            url: message.url,
            position: message.position,
            recipient_status: message.recipientStatus,
            sent_at: message.sentAt.toISOString(),
            received_at: message.receivedAt.toISOString(),
            conversation: message.conversationId,
            is_unread: false,
            sender: {
              user_id: message.sender.userId || '',
              display_name: message.sender.displayName,
              avatar_url: message.sender.avatarUrl,
              name: message.sender.name,
            },
            sync_state: message.syncState,
            parts: [{
              id: message.parts[0].id,
              body: null,
              encoding: message.parts[0].encoding,
              mime_type: message.parts[0].mimeType,
              content: null
            }]
          }]);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should generate a proper Announcement object", function() {
        var data = JSON.parse(JSON.stringify(responses.announcement));
        message = client._createObject(data);
        message.receivedAt = new Date();
        message.sender = {
          userId: 'admin',
          name: "Lord Master the Admin",
          displayName: "",
          avatarUrl: ""
        };
        var isDone = false;

        dbManager._getMessageData([message], function(result) {
          expect(result).toEqual([{
            id: message.id,
            url: message.url,
            position: message.position,
            recipient_status: message.recipientStatus,
            sent_at: message.sentAt.toISOString(),
            received_at: message.receivedAt.toISOString(),
            conversation: 'announcement',
            is_unread: message.isUnread,
            sender: {
              user_id: 'admin',
              name: 'Lord Master the Admin',
              display_name: '',
              avatar_url: ''
            },
            sync_state: message.syncState,
            parts: [{
              id: message.parts[0].id,
              body: message.parts[0].body,
              encoding: message.parts[0].encoding,
              mime_type: message.parts[0].mimeType,
              content: null
            }]
          }]);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should generate a proper Content object", function() {
        var isDone = false;
        dbManager._getMessageData([message], function(result) {
          expect(result[0]).toEqual(jasmine.objectContaining({
            parts: [{
              id: message.parts[0].id,
              body: message.parts[0].body,
              encoding: message.parts[0].encoding,
              mime_type: message.parts[0].mimeType,
              content: null
            }, {
              id: message.parts[1].id,
              body: message.parts[1].body,
              encoding: message.parts[1].encoding,
              mime_type: message.parts[1].mimeType,
              content: {
                download_url: message.parts[1]._content.downloadUrl,
                expiration:   message.parts[1]._content.expiration,
                id:  message.parts[1]._content.id,
                refresh_url:  message.parts[1]._content.refreshUrl,
                size:  message.parts[1]._content.size
              }
            }]
          }));
          isDone = true;
      });
      expect(isDone).toBe(true);
    });

    describe("The writeMessages() method", function() {
      it("Should forward isUpdate true to writeMessages", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getMessageData").and.callFake(function(data, callback) {callback([{id: 'fred'}])});
        dbManager.writeMessages([message], false);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('messages', jasmine.any(Object), false, undefined);
      });

      it("Should forward isUpdate true to writeMessages", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getMessageData").and.callFake(function(data, callback) {callback([{id: 'fred'}])});
        dbManager.writeMessages([message], true);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('messages', jasmine.any(Object), true, undefined);
      });

      it("Should feed data from _getMessageData to _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getMessageData").and.callFake(function(data, callback) {callback([{id: 'fred'}])});
        dbManager.writeMessages([message], false);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('messages', [{id: 'fred'}], jasmine.any(Boolean), undefined);
      });
    });


    describe("The _getSyncEventData() method", function() {
      var syncEvent;
      beforeEach(function() {
        syncEvent = new layer.XHRSyncEvent({
          target: "fred",
          depends: ["joe", "fred"],
          operation: "brain removal",
          data: {
            zombieCount: "cant count without brains"
          },
          url: "sue",
          headers: {'content-type': 'mountain/text'},
          method: 'POST',
          createdAt: Date.now()
        });
      });

      it("Should ignore anything that just came out of the database and clear fromDB", function() {
        syncEvent.fromDB = true;
        expect(dbManager._getSyncEventData([syncEvent])).toEqual([]);
        expect(syncEvent.fromDB).toBe(false);
      });

      it("Should generate a proper object", function() {
        expect(dbManager._getSyncEventData([syncEvent])).toEqual([{
          id: syncEvent.id,
          url: syncEvent.url,
          target: syncEvent.target,
          depends: syncEvent.depends,
          data: syncEvent.data,
          isWebsocket: false,
          created_at: syncEvent.createdAt,
          method: syncEvent.method,
          headers: syncEvent.headers,
          operation: syncEvent.operation
        }]);
      });

      it("Should generate a proper object", function() {
        var syncEvent = new layer.WebsocketSyncEvent({
          target: "fred",
          depends: ["joe", "fred"],
          operation: "brain removal",
          data: {
            zombieCount: "cant count without brains"
          },
          method: 'POST',
          createdAt: Date.now()
        });
        expect(dbManager._getSyncEventData([syncEvent])).toEqual([{
          id: syncEvent.id,
          url: '',
          target: syncEvent.target,
          depends: syncEvent.depends,
          data: syncEvent.data,
          isWebsocket: true,
          created_at: syncEvent.createdAt,
          method: null,
          headers: null,
          operation: syncEvent.operation
        }]);
      });
    });

    describe("The writeSyncEvents() method", function () {
      var syncEvent;
      beforeEach(function() {
        var syncEvent = new layer.XHRSyncEvent({
          target: "fred",
          depends: ["joe", "fred"],
          operation: "brain removal",
          data: {
            zombieCount: "cant count without brains"
          },
          url: "sue",
          headers: {'content-type': 'mountain/text'},
          method: 'POST',
          createdAt: new Date("2010-10-10")
        });
      });

      it("Should forward isUpdate true to writeSyncEvents", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getSyncEventData").and.returnValue([{id: 'fred'}]);
        dbManager.writeSyncEvents([syncEvent], false);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('syncQueue', jasmine.any(Object), false, undefined);
      });

      it("Should forward isUpdate true to writeSyncEvents", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getSyncEventData").and.returnValue([{id: 'fred'}]);
        dbManager.writeSyncEvents([syncEvent], true);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('syncQueue', jasmine.any(Object), true, undefined);
      });

      it("Should feed data from _getSyncEventData to _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getSyncEventData").and.returnValue([{id: 'fred'}]);
        dbManager.writeSyncEvents([syncEvent], false);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('syncQueue', [{id: 'fred'}], jasmine.any(Boolean), undefined);
      });
    });


    describe("The _writeObjects() method", function() {
      it("Should do nothing if no data", function() {
        var spy = jasmine.createSpy('spy');
        spyOn(dbManager, "onOpen");
        dbManager._writeObjects('conversations', [], true, spy);
        expect(spy).toHaveBeenCalledWith();
        expect(dbManager.onOpen).not.toHaveBeenCalled();
      });

      it("Should work through onOpen", function() {
        spyOn(dbManager, "onOpen");
        dbManager._writeObjects('conversations', [conversation], true, null);
        expect(dbManager.onOpen).toHaveBeenCalledWith(jasmine.any(Function));
      });

      it("Should write a conversation object", function(done) {
        dbManager._writeObjects('conversations', [{
          id: "frodo got no mojo",
          mojo: 5
        }], false, function() {
          dbManager.getObjects('conversations', ['frodo got no mojo'], function(result) {
            expect(result).toEqual([{
              id: 'frodo got no mojo',
              mojo: 5
            }]);
            done();
          });
        });
      });

      it("Should update a conversation object if called with isUpdate", function(done) {
        dbManager._writeObjects('conversations', [{
          id: "frodo got no mojo",
          mojo: 5
        }], false, function() {
          dbManager._writeObjects('conversations', [{
            id: "frodo got no mojo",
            mojo: 7
          }], true, function() {
            dbManager.getObjects('conversations', ['frodo got no mojo'], function(result) {
              expect(result).toEqual([{
                id: 'frodo got no mojo',
                mojo: 7
              }]);
              done();
            });
          });
        });
      });

      it("Should update a conversation object if called without isUpdate", function(done) {
        dbManager._writeObjects('conversations', [{
          id: "frodo got no mojo",
          mojo: 5
        }], false, function() {
          dbManager._writeObjects('conversations', [{
            id: "frodo got no mojo",
            mojo: 7
          }], false, function() {
            dbManager.getObjects('conversations', ['frodo got no mojo'], function(result) {
              expect(result).toEqual([{
                id: 'frodo got no mojo',
                mojo: 7
              }]);
              done();
            });
          });
        });
      });
    });

    describe("The loadConversations() method", function() {
      it("Should handle case where lastMessage is already loaded", function() {
        conversation.lastMessage = message;
        client._messagesHash[message.id] = message;
        client._conversationsHash = {};
        spyOn(dbManager, "_loadByIndex").and.callFake(function(tableName, sortIndex, range, isFromId, pageSize, callback) {
          callback(dbManager._getConversationData([conversation]));
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          callback([]);
        });
        spyOn(dbManager, "_loadConversationsResult");

        // Run
        var f = function() {};
        dbManager.loadConversations('last_message', null, null, f);

        // Posttest
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'last_message_sent', null, false, null, jasmine.any(Function));
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [], jasmine.any(Function));
        expect(dbManager._loadConversationsResult).toHaveBeenCalledWith(
          dbManager._getConversationData([conversation]),
          [],
          f
        );
      });

      it("Should handle case where lastMessage is empty", function() {
        conversation.lastMessage = null;
        client._messagesHash = {};
        spyOn(dbManager, "_loadByIndex").and.callFake(function(tableName, sortIndex, range, isFromId, pageSize, callback) {
          callback(dbManager._getConversationData([conversation]));
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          callback([]);
        });
        spyOn(dbManager, "_loadConversationsResult");

        // Run
        var f = function() {};
        dbManager.loadConversations('created_at', null, null, f);

        // Posttest
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'created_at', null, false, null, jasmine.any(Function));
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [], jasmine.any(Function));
        expect(dbManager._loadConversationsResult).toHaveBeenCalledWith(
          dbManager._getConversationData([conversation]),
          [],
          f
        );
      });

      it("Should handle case where lastMessage is not already loaded", function() {
        conversation.lastMessage = message;
        delete client._messagesHash[message.id];
        spyOn(dbManager, "_loadByIndex").and.callFake(function(tableName, sortIndex, range, isFromId, pageSize, callback) {
          callback(dbManager._getConversationData([conversation]));
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          dbManager._getMessageData([message], function(result) {
            callback(result);
          });
        });
        spyOn(dbManager, "_loadConversationsResult");


        // Run
        var f = function() {};
        dbManager.loadConversations('created_at', null, null, f);

        // Posttest
        var getMessageData;
        dbManager._getMessageData([message], function(result) {getMessageData = result;});
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'created_at', null, false, null, jasmine.any(Function));
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [message.id], jasmine.any(Function));
        expect(dbManager._loadConversationsResult).toHaveBeenCalledWith(
          dbManager._getConversationData([conversation]),
          getMessageData,
          f
        );
      });

      it("Should use the fromId and pageSize properties", function() {
        spyOn(dbManager, "_loadByIndex")
        dbManager.loadConversations('created_at', conversation.id, 5);

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'created_at', jasmine.any(IDBKeyRange), true, 5, jasmine.any(Function));
        expect(range.upper).toEqual([conversation.createdAt.toISOString()]);
        expect(range.lower).toEqual(undefined);
      });
    });


    describe("The _loadConversationsResult() method", function() {
      it("Should call _createMessage for each Message", function() {
        spyOn(dbManager, "_createMessage");
        var m1 = conversation.createMessage("m1").send();
        var m2 = conversation.createMessage("m2").send();
        var m1Data, m2Data;
        dbManager._getMessageData([m1, m2], function(result) {
          m1Data = result[0];
          m2Data = result[1];
        });

        // Run
        dbManager._getMessageData([m1, m2], function(result) {
          dbManager._loadConversationsResult([], result);
        });

        // Posttest
        expect(dbManager._createMessage).toHaveBeenCalledWith(m1Data);
        expect(dbManager._createMessage).toHaveBeenCalledWith(m2Data);
      });

      it("Should call _createConversation for each Conversation", function() {
        spyOn(dbManager, "_createConversation");
        var c1 = client.createConversation({participants: ["c1"]});
        var c2 = client.createConversation({participants: ["c2"]});
        c1.syncState = c2.syncState = layer.Constants.SYNC_STATE.SYNCED;

        // Run
        dbManager._loadConversationsResult(dbManager._getConversationData([c1, c2]), []);

        // Posttest
        expect(dbManager._createConversation).toHaveBeenCalledWith(dbManager._getConversationData([c1])[0]);
        expect(dbManager._createConversation).toHaveBeenCalledWith(dbManager._getConversationData([c2])[0]);
      });

      it("Should filter out any Conversation that was already loaded", function() {
        var callback = jasmine.createSpy('callback');
        var c1 = client.createConversation({participants: ["c1"]});
        var c2 = client.createConversation({participants: ["c2"]});
        c1.syncState = c2.syncState = layer.Constants.SYNC_STATE.SYNCED;
        client._conversationsHash = {};
        client._conversationsHash[c2.id] = c2;

        // Run
        dbManager._loadConversationsResult(dbManager._getConversationData([c1, c2]), [], callback);

        // Posttest
        expect(callback).toHaveBeenCalledWith([jasmine.objectContaining({id: c1.id}), jasmine.objectContaining({id: c2.id})]);
      });
    });

    describe("The loadMessages() method", function() {
      it("Should call _loadByIndex", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadMessages(conversation.id);


        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversation', jasmine.any(IDBKeyRange), false, undefined, jasmine.any(Function));
        expect(range.lower).toEqual([conversation.id, 0]);
        expect(range.upper).toEqual([conversation.id, MAX_SAFE_INTEGER]);
      });

      it("Should call _loadByIndex with fromId and pageSize", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadMessages(conversation.id, message.id, 12);

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversation', jasmine.any(IDBKeyRange), true, 12, jasmine.any(Function));
        expect(range.lower).toEqual([conversation.id, 0]);
        expect(range.upper).toEqual([conversation.id, message.position]);
      });

      it("Should call _loadMessagesResult", function() {
        spyOn(dbManager, "_loadMessagesResult");
        spyOn(dbManager, "_loadByIndex").and.callFake(function(table, index, range, isFromId, pageSize, callback) {
          callback([message]);
        });
        var spy = jasmine.createSpy('spy');
        dbManager.loadMessages(conversation.id, null, null, spy);
        expect(dbManager._loadMessagesResult).toHaveBeenCalledWith([message], spy);
      });
    });

    describe("The loadAnnouncements() method", function() {
      it("Should call _loadByIndex", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadAnnouncements();

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversation', jasmine.any(IDBKeyRange), false, undefined, jasmine.any(Function));
        expect(range.lower).toEqual(['announcement', 0]);
        expect(range.upper).toEqual(['announcement', MAX_SAFE_INTEGER]);
      });

      it("Should call _loadByIndex with fromId", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadAnnouncements(announcement.id, 12);
        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversation', jasmine.any(IDBKeyRange), true, 12, jasmine.any(Function));
        expect(range.lower).toEqual(['announcement', 0]);
        expect(range.upper).toEqual(['announcement', announcement.position]);
      });

      it("Should call _loadMessagesResult", function() {
        spyOn(dbManager, "_loadMessagesResult");
        spyOn(dbManager, "_loadByIndex").and.callFake(function(table, index, query, isFromId, pageSize, callback) {
          callback([message]);
        });
        var spy = jasmine.createSpy('spy');
        dbManager.loadAnnouncements(null, null, spy);
        expect(dbManager._loadMessagesResult).toHaveBeenCalledWith([message], spy);
      });
    });

    describe("The _loadMessagesResult() method", function() {
      it("Calls createMessage on each message", function() {
        var m1 = conversation.createMessage("m1").send();
        var m2 = conversation.createMessage("m2").send();
        var m1Data, m2Data;
        dbManager._getMessageData([m1, m2], function(result) {
          m1Data = result[0];
          m2Data = result[1];
        });
        spyOn(dbManager, "_createMessage");

        // Run
        dbManager._getMessageData([m1, m2], function(result) {
          dbManager._loadMessagesResult(result);
        });

        // Posttest
        expect(dbManager._createMessage).toHaveBeenCalledWith(m1Data);
        expect(dbManager._createMessage).toHaveBeenCalledWith(m2Data);
      });

      it("Returns new and existing messages", function() {
        var m1 = conversation.createMessage("m1").send();
        var m2 = conversation.createMessage("m2");
        client._messagesHash = {}
        client._messagesHash[m2.id] = m2;

        var spy = jasmine.createSpy('spy');

        // Run
        dbManager._getMessageData([m1, m2], function(result) {
          dbManager._loadMessagesResult(result, spy);
        });

        // Posttest
        expect(spy).toHaveBeenCalledWith([jasmine.objectContaining({id: m1.id}), m2]);
      });
    });


    describe("The _createConversation() method", function() {
      it("Should return a Conversation", function() {
        delete client._conversationsHash[conversation.id];
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0])).toEqual(jasmine.any(layer.Conversation));
      });

      it("Should flag Conversation with _fromDB property", function() {
        delete client._conversationsHash[conversation.id];
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0])._fromDB).toBe(true);
      });

      it("Should set lastMessage if the id is found", function() {
        delete client._conversationsHash[conversation.id];
        var message = conversation.lastMessage;
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0]).lastMessage).toBe(message);
      });

      it("Should do nothing if the Conversation already is instantiated", function() {
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0])).toBe(undefined);
      });
    });


    describe("The _createMessage() method", function() {
      it("Should return a Message", function() {
        delete client._messagesHash[message.id];
        isDone = false;
        dbManager._getMessageData([message], function(result) {
          var m = dbManager._createMessage(result[0]);
          expect(m).toEqual(jasmine.any(layer.Message));
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should flag Message with _fromDB property", function() {
        delete client._messagesHash[message.id];
        isDone = false;
        dbManager._getMessageData([message], function(result) {
          var m = dbManager._createMessage(result[0]);
          expect(m._fromDB).toBe(true);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should do nothing if the Message already is instantiated", function() {
        client._messagesHash[message.id] = message;
        isDone = false;
        dbManager._getMessageData([message], function(result) {
          var m = dbManager._createMessage(result[0]);
          expect(m).toBe(undefined);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });
    });


    describe("The loadSyncQueue() method", function() {
      it("Should call _loadAll", function() {
        spyOn(dbManager, "_loadAll");
        dbManager.loadSyncQueue();
        expect(dbManager._loadAll).toHaveBeenCalledWith('syncQueue', jasmine.any(Function));
      });

      it("Should call _loadSyncEventRelatedData with results", function() {
        spyOn(dbManager, "_loadSyncEventRelatedData");
        var spy = jasmine.createSpy('callback');
        var syncEvent = new layer.XHRSyncEvent({});
        var syncEventRaw = dbManager._getSyncEventData([syncEvent])[0];
        spyOn(dbManager, "_loadAll").and.callFake(function(tableName, callback) {
          callback([syncEventRaw]);
        });

        dbManager.loadSyncQueue(spy);
        expect(dbManager._loadSyncEventRelatedData).toHaveBeenCalledWith([syncEventRaw], spy);
      });
    });

    describe("The _loadSyncEventRelatedData() method", function() {
      var rawSyncEvents;
      beforeEach(function() {
        rawSyncEvents = dbManager._getSyncEventData([
           new layer.XHRSyncEvent({
             target: conversation.id
           }),
           new layer.XHRSyncEvent({
             target: message.id
           })
        ]);
      });

      it("Should call getObjects for all messageIds", function() {
        spyOn(dbManager, "getObjects");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [message.id], jasmine.any(Function));
      });

      it("Should call _createMessage for all messageIds", function() {
        var rawMessage;
        dbManager._getMessageData([message], function(result) {
           rawMessage = result[0];
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'messages') {
            callback([rawMessage]);
          } else {
            callback([]);
          }
        });
        spyOn(dbManager, "_createMessage");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createMessage).toHaveBeenCalledWith(rawMessage);
      });

      it("Should call getObjects for all conversationIds", function() {
        var rawConversation = dbManager._getConversationData([conversation])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'conversations') {
            callback([rawConversation]);
          } else {
            callback([]);
          }
        });
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager.getObjects).toHaveBeenCalledWith('conversations', [conversation.id], jasmine.any(Function));
      });

      it("Should call _createConversation for all conversationIds", function() {
        var rawConversation = dbManager._getConversationData([conversation])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'conversations') {
            callback([rawConversation]);
          } else {
            callback([]);
          }
        });
        spyOn(dbManager, "_createConversation");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createConversation).toHaveBeenCalledWith(rawConversation);
      });

      it("Should not call _createConversation for deleted conversationIds", function() {
        var rawConversation = dbManager._getConversationData([conversation])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'conversations') {
            expect(ids.indexOf(rawSyncEvents[0].target) === -1).toBe(true);
          }
          callback([]);
        });
        spyOn(dbManager, "_createConversation");
        rawSyncEvents[0].operation = "DELETE";
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createConversation).not.toHaveBeenCalledWith(rawConversation);
      });

      it("Should call _loadSyncEventResults", function() {
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          callback([]);
        });
        spyOn(dbManager, "_loadSyncEventResults");
        var spy = jasmine.createSpy('callback');
        dbManager._loadSyncEventRelatedData(rawSyncEvents, spy);
        expect(dbManager._loadSyncEventResults).toHaveBeenCalledWith(rawSyncEvents, spy);
        expect(dbManager.getObjects.calls.count()).toEqual(2);
      });
    });

    describe("The _loadSyncEventResults() method", function() {
      var syncEvents, now;
      beforeEach(function() {
        now = Date.now();
        syncEvents = [
          new layer.WebsocketSyncEvent({
            target: message.id,
            depends: [conversation.id],
            operation: "POST",
            id: "fred",
            data: {hey: "ho"},
            createdAt: now,
            fromDB: false
          }),
          new layer.XHRSyncEvent({
            target: conversation.id,
            depends: [],
            operation: "update",
            id: "derf",
            data: {ho: "hey"},
            headers: {accept: 'ho'},
            method: "PATCH",
            url: "howdy",
            createdAt: now,
            fromDB: false
          }),
          new layer.XHRSyncEvent({
            target: conversation.id + 'a',
            depends: [],
            operation: "update",
            id: "derf",
            data: {ho: "hey"},
            headers: {accept: 'ho'},
            method: "PATCH",
            url: "howdy",
            createdAt: now,
            fromDB: false
          }),
          new layer.XHRSyncEvent({
            target: conversation.id + 'b',
            depends: [],
            operation: "DELETE",
            id: "derf",
            data: {ho: "hey"},
            headers: {accept: 'ho'},
            method: "DELETE",
            url: "howdy",
            createdAt: now,
            fromDB: false
          })
        ];
        client._messagesHash[message.id] = message;
      });
      it("Should return XHRSyncEvents", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });
        expect(result[1].fromDB).toBe(true);
        result[1].fromDB = false;
        expect(result[1]).toEqual(syncEvents[1]);
      });

      it("Should return WebsocketSyncEvents", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });
        expect(result[0].fromDB).toBe(true);
        result[0].fromDB = false;
        expect(result[0]).toEqual(syncEvents[0]);
      });

      it("Should filter out SyncEvents whose target cant be found", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });
        expect(result.filter(function(item) {
          return item.target == conversation.id + 'a';
        })).toEqual([]);
      });

      it("Should not filter out SyncEvents whose target cant be found if its a DELETE operation", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });

        expect(result.filter(function(item) {
          return item.target == conversation.id + 'b';
        })[0].id).toEqual(syncEvents[2].id);
      });
    });

    describe("The _loadAll() method", function() {
      var m1, m2, m3, m4;
      var writtenData;
      beforeEach(function(done) {
        deleteTables(function() {
          m1 = conversation.createMessage("m1").send();
          m2 = conversation.createMessage("m2").send();
          m3 = conversation.createMessage("m3").send();
          m4 = conversation.createMessage("m4").send();
          dbManager._getMessageData([message, m4, m2, m3, m1], function(result) {
            writtenData = result;
            dbManager._writeObjects('messages', result, false, done);
          });
        });
      });

      it("Should load everything in the table", function(done) {
        dbManager._loadAll('messages', function(result) {
          var sortedExpect = layer.Util.sortBy(writtenData, function(item) {return item.id});
          expect(result).toEqual(sortedExpect);
          done();
        });
      });

      it("Should load nothing if table is", function(done) {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {conversations: true}
        });
        dbManager._loadAll('messages', function(result) {
          expect(result).toEqual([]);
          done();
        });
      });
    });

    describe("The _loadByIndex() method", function() {
      var m1, m2, m3, m4;
      var writtenData;
      beforeEach(function(done) {
        deleteTables(function() {
          var c2 = client.createConversation({participants: ["c2"]});
          message = conversation.createMessage("first message").send();
          m1 = conversation.createMessage("m1").send();
          m2 = conversation.createMessage("m2").send();
          m3 = c2.createMessage("m3").send();
          m4 = c2.createMessage("m4").send();
          setTimeout(function() {
            dbManager._getMessageData([m1, m2, m3, m4], function(result) {
              writtenData = result;
              dbManager._writeObjects('messages', result, false, done);
            });
          }, 200);
        });
      });

      it("Should get only items matching the index", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m1, message], function(result) { expectedResult = result; });
        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversation', query, false, null, function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.position}).reverse();
          expect(result).toEqual(sortedExpect);
          done();
        });
      });

      it("Should apply pageSize", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m1, message], function(result) { expectedResult = result; });

        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversation', query, false, 2, function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.position}).reverse();

          expect(result).toEqual([sortedExpect[0], sortedExpect[1]]);
          done();
        });
      });

      it("Should skip first result if isFromId", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m1, message], function(result) { expectedResult = result; });

        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversation', query, true, null, function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.position}).reverse();

          expect(result).toEqual([sortedExpect[1], sortedExpect[2]]);
          done();
        });
      });


      it("Should get nothing if disabled", function(done) {
        var dbManager = new layer.DbManager({
          client: client,
          tables: {messages: false}
         });
        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversation', query, false, null, function(result) {
          expect(result).toEqual([]);
          done();
        });
      });
    });


    describe("The deleteObjects() method", function() {

      var m1, m2, m3, m4;
      var writtenData;
      beforeEach(function(done) {
        deleteTables(function() {
          m1 = conversation.createMessage("m1").send();
          m2 = conversation.createMessage("m2").send();
          m3 = conversation.createMessage("m3").send();
          m4 = conversation.createMessage("m4").send();
          dbManager._getMessageData([m1, m2, m3, m4], function(result) {
            writtenData = result;
            dbManager._writeObjects('messages', result, false, function() {
              setTimeout(done, 200);
            });
          });
        });
      });

      it("Should delete all of the specified items", function(done) {
        var expectedResult;
        dbManager._getMessageData([m4, m2], function(result) {expectedResult = result;});
        dbManager.deleteObjects('messages', [m1, m3], function() {
          dbManager._loadAll('messages', function(result) {
            var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.id});
            expect(result).toEqual(sortedExpect);
            done();
          });
        });
      });
    });

    describe("The getObjects() method", function() {
      var m1, m2, m3, m4;
      beforeEach(function(done) {
        m1 = conversation.createMessage("m1").send();
        m2 = conversation.createMessage("m2").send();
        m3 = conversation.createMessage("m3").send();
        m4 = conversation.createMessage("m4").send();
        dbManager._getMessageData([m1, m2, m3, m4], function(result) {
          dbManager._writeObjects('messages', result, false, done);
        });
      });
      it("Should get the specified objects", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m4, m1], function(result) {expectedResult = result;});
        dbManager.getObjects('messages', [m2.id, m4.id, m1.id], function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.id});
          expect(result).toEqual(sortedExpect);
          done();
        });
      });
    });

    describe("The getObject() method", function() {
      var m1;
      beforeEach(function(done) {
        m1 = conversation.createMessage({
          parts: [
            {mimeType: 'text/plain', body: 'm1'},
            {mimeType: 'he/ho', body: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAECElEQVR4Xu2ZO44TURREa0SAWBASKST8xCdDQMAq+OyAzw4ISfmLDBASISERi2ADEICEWrKlkYWny6+77fuqalJfz0zVOXNfv/ER8mXdwJF1+oRHBDCXIAJEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8waWjX8OwHcAv5f9Me3fPRugvbuxd14C8B7AVwA3q0oQAcYwtr2+hn969faPVSWIAG2AT3rXJvz17CcAN6ptgggwrwDb4JeVIALMJ8AY/JISRIB5BGDhr3/aZwDXKxwHEWC6AJcBvAOwfuBjvuNfABcBfGGGl5yJANPabYV/B8DLaT96nndHgPYeu4c/RI8AbQJIwO9FgDMAfrVxWuRdMvB7EOA+gHsALgD4uQjO3b6pFPzqAjwA8HTF5weA8weWQA5+ZQGOw1//jR5SAkn4VQV4CODJls18CAmuAHjbcM8vc9U76ZSrdgt4BODxyLG8Twla4P8BcLfKPX/sEaeSAAz8fR4H8vArHQHXAHwYs3Xj9SU3gQX8SgKcAvBitTp38WAJCWzgVxJg+F0qSGAFv5oAh5bADn5FAQ4lwVUAb3a86nX1tL/tXK10Czj+O+7zOLCFX3UDrEXYhwTW8KsLsPRx0Ap/+A/fq12uKpVnqx4BSx8Hgb9quAcB5t4EgX/sz6sXAeaSIPA3zqOeBJgqwTMAzxuuelJn/ubzSG8CTJFg12ex4Z4vDb+HW8A2aK1XRFYCC/g9C7DkJrCB37sAS0hgBV9BgDklGODfBvCaPScU5np8CPxf71OfCSzhq2yAqZ8d2MJXE6DlOLCGryjALhLYw1cVgJEg8Dv7MKjlgXvbg2Hgd/ph0BwSBH7nHwZNkeCW4z1/rDCV/wOM5RyOg7MAvo0Nur3uIoAbVzpvBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hz8BzIXtYE3VcPnAAAAAElFTkSuQmCC'}
          ]
        }).send();
        dbManager._getMessageData([m1], function(result) {
          dbManager._writeObjects('messages', result, false, done);
        });
      });
      it("Should get the specified object", function(done) {
        var expectedResult;
        dbManager._getMessageData([m1], function(result) {
          expectedResult = result;
          expectedResult[0].conversation = {
            id: expectedResult[0].conversation
          };
        });
        dbManager.getObject('messages', m1.id, function(result) {
          result.parts.pop(); expectedResult[0].parts.pop(); // Next test focuses on blobs
          delete result.sent_at;
          delete expectedResult[0].sent_at;
          expect(result).toEqual(expectedResult[0]);
          done();
        });
      });

      it("Should get the specified object with blob data and no encoding", function(done) {
        dbManager.getObject('messages', m1.id, function(result) {
          expect(result.parts[1].encoding).toBe(null);
          expect(layer.Util.isBlob(result.parts[1].body)).toBe(true);
          done();
        });
      });
    });
  });
});

