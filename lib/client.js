'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Layer Client; this is the top level component for any Layer based application.

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
      challenge: function(evt) {
        myAuthenticator({
          nonce: evt.nonce,
          onSuccess: evt.callback
        });
      },
      ready: function(client) {
        alert('I am Client; Server: Serve me!');
      }
    }).connect('Fred')
 *
 * You can also initialize this as

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff'
    });

    client.on('challenge', function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    });

    client.on('ready', function(client) {
      alert('I am Client; Server: Serve me!');
    });

    client.connect('Fred');
 *
 * ## API Synopsis:
 *
 * The following Properties, Methods and Events are the most commonly used ones.  See the full API below
 * for the rest of the API.
 *
 * ### Properties:
 *
 * * layer.Client.userId: User ID of the authenticated user
 * * layer.Client.appId: The ID for your application
 *
 *
 * ### Methods:
 *
 * * layer.Client.createConversation(): Create a new layer.Conversation.
 * * layer.Client.createQuery(): Create a new layer.Query.
 * * layer.Client.getMessage(): Input a Message ID, and output a layer.Message or layer.Announcement from cache.
 * * layer.Client.getConversation(): Input a Conversation ID, and output a layer.Conversation from cache.
 * * layer.Client.on() and layer.Conversation.off(): event listeners
 * * layer.Client.destroy(): Cleanup all resources used by this client, including all Messages and Conversations.
 *
 * ### Events:
 *
 * * `challenge`: Provides a nonce and a callback; you call the callback once you have an Identity Token.
 * * `ready`: Your application can now start using the Layer services
 * * `messages:notify`: Used to notify your application of new messages for which a local notification may be suitable.
 *
 * ## Logging:
 *
 * There are two ways to change the log level for Layer's logger:
 *
 *     layer.Client.prototype.logLevel = layer.Constants.LOG.INFO;
 *
 * or
 *
 *     var client = new layer.Client({
 *        appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
 *        logLevel: layer.Constants.LOG.INFO
 *     });
 *
 * @class  layer.Client
 * @extends layer.ClientAuthenticator
 *
 */

var ClientAuth = require('./client-authenticator');
var Conversation = require('./conversation');
var Query = require('./query');
var ErrorDictionary = require('./layer-error').dictionary;
var Syncable = require('./syncable');
var Message = require('./message');
var Announcement = require('./announcement');
var Identity = require('./identity');
var TypingIndicatorListener = require('./typing-indicators/typing-indicator-listener');
var Util = require('./client-utils');
var Root = require('./root');
var ClientRegistry = require('./client-registry');
var logger = require('./logger');

var Client = function (_ClientAuth) {
  _inherits(Client, _ClientAuth);

  /*
   * Adds conversations, messages and websockets on top of the authentication client.
   * jsdocs on parent class constructor.
   */
  function Client(options) {
    _classCallCheck(this, Client);

    var _this = _possibleConstructorReturn(this, (Client.__proto__ || Object.getPrototypeOf(Client)).call(this, options));

    ClientRegistry.register(_this);

    // Initialize Properties
    _this._conversationsHash = {};
    _this._messagesHash = {};
    _this._queriesHash = {};
    _this._identitiesHash = {};
    _this._scheduleCheckAndPurgeCacheItems = [];

    _this._initComponents();

    _this.on('online', _this._connectionRestored.bind(_this));

    logger.info(Util.asciiInit(Client.version));
    return _this;
  }

  /* See parent method docs */


  _createClass(Client, [{
    key: '_initComponents',
    value: function _initComponents() {
      var _this2 = this;

      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), '_initComponents', this).call(this);

      this._typingIndicators = new TypingIndicatorListener({
        clientId: this.appId
      });

      // Instantiate Plugins
      Object.keys(Client.plugins).forEach(function (propertyName) {
        _this2[propertyName] = new Client.plugins[propertyName](_this2);
      });
    }

    /**
     * Cleanup all resources (Conversations, Messages, etc...) prior to destroy or reauthentication.
     *
     * @method _cleanup
     * @private
     */

  }, {
    key: '_cleanup',
    value: function _cleanup() {
      var _this3 = this;

      if (this.isDestroyed) return;
      this._inCleanup = true;

      Object.keys(this._conversationsHash).forEach(function (id) {
        var c = _this3._conversationsHash[id];
        if (c && !c.isDestroyed) {
          c.destroy();
        }
      });
      this._conversationsHash = null;

      Object.keys(this._messagesHash).forEach(function (id) {
        var m = _this3._messagesHash[id];
        if (m && !m.isDestroyed) {
          m.destroy();
        }
      });
      this._messagesHash = null;

      Object.keys(this._queriesHash).forEach(function (id) {
        _this3._queriesHash[id].destroy();
      });
      this._queriesHash = null;

      Object.keys(this._identitiesHash).forEach(function (id) {
        var identity = _this3._identitiesHash[id];
        if (identity && !identity.isDestroyed) {
          identity.destroy();
        }
      });
      this._identitiesHash = null;

      if (this.socketManager) this.socketManager.close();
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      var _this4 = this;

      // Cleanup all plugins
      Object.keys(Client.plugins).forEach(function (propertyName) {
        if (_this4[propertyName]) {
          _this4[propertyName].destroy();
          delete _this4[propertyName];
        }
      });

      // Cleanup all resources (Conversations, Messages, etc...)
      this._cleanup();

      this._destroyComponents();

      ClientRegistry.unregister(this);

      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), 'destroy', this).call(this);
      this._inCleanup = false;
    }
  }, {
    key: '__adjustAppId',
    value: function __adjustAppId() {
      if (this.appId) throw new Error(ErrorDictionary.appIdImmutable);
    }

    /**
     * Retrieve a conversation by Identifier.
     *
     *      var c = client.getConversation('layer:///conversations/uuid');
     *
     * If there is not a conversation with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Conversation instance that has no data; the `conversations:loaded` / `conversations:loaded-error` events
     * will let you know when the conversation has finished/failed loading from the server.
     *
     *      var c = client.getConversation('layer:///conversations/123', true)
     *      .on('conversations:loaded', function() {
     *          // Render the Conversation with all of its details loaded
     *          myrerender(c);
     *      });
     *      // Render a placeholder for c until the details of c have loaded
     *      myrender(c);
     *
     * Note in the above example that the `conversations:loaded` event will trigger even if the Conversation has previously loaded.
     *
     * @method getConversation
     * @param  {string} id
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a conversation from
     *                                    the server if not found
     * @return {layer.Conversation}
     */

  }, {
    key: 'getConversation',
    value: function getConversation(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (this._conversationsHash[id]) {
        return this._conversationsHash[id];
      } else if (canLoad) {
        return Conversation.load(id, this);
      }
      return null;
    }

    /**
     * Adds a conversation to the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _addConversation for you:
     *
     *      var conv = new layer.Conversation({
     *          client: client,
     *          participants: ['a', 'b']
     *      });
     *
     *      // OR:
     *      var conv = client.createConversation(['a', 'b']);
     *
     * @method _addConversation
     * @protected
     * @param  {layer.Conversation} c
     */

  }, {
    key: '_addConversation',
    value: function _addConversation(conversation) {
      var id = conversation.id;
      if (!this._conversationsHash[id]) {
        // Register the Conversation
        this._conversationsHash[id] = conversation;

        // Make sure the client is set so that the next event bubbles up
        if (conversation.clientId !== this.appId) conversation.clientId = this.appId;
        this._triggerAsync('conversations:add', { conversations: [conversation] });

        this._scheduleCheckAndPurgeCache(conversation);
      }
    }

    /**
     * Removes a conversation from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeConversation for you:
     *
     *      converation.destroy();
     *
     * @method _removeConversation
     * @protected
     * @param  {layer.Conversation} c
     */

  }, {
    key: '_removeConversation',
    value: function _removeConversation(conversation) {
      var _this5 = this;

      // Insure we do not get any events, such as message:remove
      conversation.off(null, null, this);

      if (this._conversationsHash[conversation.id]) {
        delete this._conversationsHash[conversation.id];
        this._triggerAsync('conversations:remove', { conversations: [conversation] });
      }

      // Remove any Message associated with this Conversation
      Object.keys(this._messagesHash).forEach(function (id) {
        if (_this5._messagesHash[id].conversationId === conversation.id) {
          _this5._messagesHash[id].destroy();
        }
      });
    }

    /**
     * If the Conversation ID changes, we need to reregister the Conversation
     *
     * @method _updateConversationId
     * @protected
     * @param  {layer.Conversation} conversation - Conversation whose ID has changed
     * @param  {string} oldId - Previous ID
     */

  }, {
    key: '_updateConversationId',
    value: function _updateConversationId(conversation, oldId) {
      var _this6 = this;

      if (this._conversationsHash[oldId]) {
        this._conversationsHash[conversation.id] = conversation;
        delete this._conversationsHash[oldId];

        // This is a nasty way to work... but need to find and update all
        // conversationId properties of all Messages or the Query's won't
        // see these as matching the query.
        Object.keys(this._messagesHash).filter(function (id) {
          return _this6._messagesHash[id].conversationId === oldId;
        }).forEach(function (id) {
          return _this6._messagesHash[id].conversationId = conversation.id;
        });
      }
    }

    /**
     * Retrieve the message or announcement id.
     *
     * Useful for finding a message when you have only the ID.
     *
     * If the message is not found, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Message instance that has no data; the messages:loaded/messages:loaded-error events
     * will let you know when the message has finished/failed loading from the server.
     *
     *      var m = client.getMessage('layer:///messages/123', true)
     *      .on('messages:loaded', function() {
     *          // Render the Message with all of its details loaded
     *          myrerender(m);
     *      });
     *      // Render a placeholder for m until the details of m have loaded
     *      myrender(m);
     *
     *
     * @method getMessage
     * @param  {string} id              - layer:///messages/uuid
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a message from the server if not found
     * @return {layer.Message}
     */

  }, {
    key: 'getMessage',
    value: function getMessage(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      if (this._messagesHash[id]) {
        return this._messagesHash[id];
      } else if (canLoad) {
        return Syncable.load(id, this);
      }
      return null;
    }

    /**
     * Get a MessagePart by ID
     *
     * ```
     * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
     * ```
     *
     * @method getMessagePart
     * @param {String} id - ID of the Message Part; layer:///messages/uuid/parts/5
     */

  }, {
    key: 'getMessagePart',
    value: function getMessagePart(id) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      var messageId = id.replace(/\/parts.*$/, '');
      var message = this.getMessage(messageId);
      if (message) return message.getPartById(id);
      return null;
    }

    /**
     * Registers a message in _messagesHash and triggers events.
     *
     * May also update Conversation.lastMessage.
     *
     * @method _addMessage
     * @protected
     * @param  {layer.Message} message
     */

  }, {
    key: '_addMessage',
    value: function _addMessage(message) {
      if (!this._messagesHash[message.id]) {
        this._messagesHash[message.id] = message;
        this._triggerAsync('messages:add', { messages: [message] });
        if (message._notify) {
          this._triggerAsync('messages:notify', { message: message });
          message._notify = false;
        }

        var conversation = message.getConversation(false);
        if (conversation && (!conversation.lastMessage || conversation.lastMessage.position < message.position)) {
          var lastMessageWas = conversation.lastMessage;
          conversation.lastMessage = message;
          if (lastMessageWas) this._scheduleCheckAndPurgeCache(lastMessageWas);
        } else {
          this._scheduleCheckAndPurgeCache(message);
        }
      }
    }

    /**
     * Removes message from _messagesHash.
     *
     * Accepts IDs or Message instances
     *
     * TODO: Remove support for remove by ID
     *
     * @method _removeMessage
     * @private
     * @param  {layer.Message|string} message or Message ID
     */

  }, {
    key: '_removeMessage',
    value: function _removeMessage(message) {
      var id = typeof message === 'string' ? message : message.id;
      message = this._messagesHash[id];
      if (message) {
        delete this._messagesHash[id];
        if (!this._inCleanup) {
          this._triggerAsync('messages:remove', { messages: [message] });
          var conv = message.getConversation(false);
          if (conv && conv.lastMessage === message) conv.lastMessage = null;
        }
      }
    }

    /**
     * Handles delete from position event from Websocket.
     *
     * A WebSocket may deliver a `delete` Conversation event with a
     * from_position field indicating that all Messages at the specified position
     * and earlier should be deleted.
     *
     * @method _purgeMessagesByPosition
     * @private
     * @param {string} conversationId
     * @param {number} fromPosition
     */

  }, {
    key: '_purgeMessagesByPosition',
    value: function _purgeMessagesByPosition(conversationId, fromPosition) {
      var _this7 = this;

      Object.keys(this._messagesHash).forEach(function (mId) {
        var message = _this7._messagesHash[mId];
        if (message.conversationId === conversationId && message.position <= fromPosition) {
          message.destroy();
        }
      });
    }

    /**
     * Retrieve a identity by Identifier.
     *
     *      var identity = client.getIdentity('layer:///identities/user_id');
     *
     * If there is not an Identity with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * This is only supported for User Identities, not Service Identities.
     *
     * If loading from the server, the method will return
     * a layer.Identity instance that has no data; the identities:loaded/identities:loaded-error events
     * will let you know when the identity has finished/failed loading from the server.
     *
     *      var user = client.getIdentity('layer:///identities/123', true)
     *      .on('identities:loaded', function() {
     *          // Render the user list with all of its details loaded
     *          myrerender(user);
     *      });
     *      // Render a placeholder for user until the details of user have loaded
     *      myrender(user);
     *
     * @method getIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @param  {boolean} [canLoad=false] - Pass true to allow loading an identity from
     *                                    the server if not found
     * @return {layer.Identity}
     */

  }, {
    key: 'getIdentity',
    value: function getIdentity(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }

      if (this._identitiesHash[id]) {
        return this._identitiesHash[id];
      } else if (canLoad) {
        return Identity.load(id, this);
      }
      return null;
    }

    /**
     * Takes an array of Identity instances, User IDs, Identity IDs, Identity objects,
     * or Server formatted Identity Objects and returns an array of Identity instances.
     *
     * @method _fixIdentities
     * @private
     * @param {Mixed[]} identities - Something that tells us what Identity to return
     * @return {layer.Identity[]}
     */

  }, {
    key: '_fixIdentities',
    value: function _fixIdentities(identities) {
      var _this8 = this;

      return identities.map(function (identity) {
        if (identity instanceof Identity) return identity;
        if (typeof identity === 'string') {
          return _this8.getIdentity(identity, true);
        } else if (identity && (typeof identity === 'undefined' ? 'undefined' : _typeof(identity)) === 'object') {
          if ('userId' in identity) {
            return _this8.getIdentity(identity.id || identity.userId);
          } else if ('user_id' in identity) {
            return _this8._createObject(identity);
          }
        }
      });
    }

    /**
     * Adds an identity to the client.
     *
     * Typically, you do not need to call this; the Identity constructor will call this.
     *
     * @method _addIdentity
     * @protected
     * @param  {layer.Identity} identity
     *
     * TODO: It should be possible to add an Identity whose userId is populated, but
     * other values are not yet loaded from the server.  Should add to _identitiesHash now
     * but trigger `identities:add` only when its got enough data to be renderable.
     */

  }, {
    key: '_addIdentity',
    value: function _addIdentity(identity) {
      var id = identity.id;
      if (id && !this._identitiesHash[id]) {
        // Register the Identity
        this._identitiesHash[id] = identity;
        this._triggerAsync('identities:add', { identities: [identity] });
      }
    }

    /**
     * Removes an identity from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeIdentity for you:
     *
     *      identity.destroy();
     *
     * @method _removeIdentity
     * @protected
     * @param  {layer.Identity} identity
     */

  }, {
    key: '_removeIdentity',
    value: function _removeIdentity(identity) {
      // Insure we do not get any events, such as message:remove
      identity.off(null, null, this);

      var id = identity.id;
      if (this._identitiesHash[id]) {
        delete this._identitiesHash[id];
        this._triggerAsync('identities:remove', { identities: [identity] });
      }
    }

    /**
     * Follow this user and get Full Identity, and websocket changes on Identity.
     *
     * @method followIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @returns {layer.Identity}
     */

  }, {
    key: 'followIdentity',
    value: function followIdentity(id) {
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }
      var identity = this.getIdentity(id);
      if (!identity) {
        identity = new Identity({
          id: id,
          clientId: this.appId,
          userId: id.substring(20)
        });
      }
      identity.follow();
      return identity;
    }

    /**
     * Unfollow this user and get only Basic Identity, and no websocket changes on Identity.
     *
     * @method unfollowIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @returns {layer.Identity}
     */

  }, {
    key: 'unfollowIdentity',
    value: function unfollowIdentity(id) {
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }
      var identity = this.getIdentity(id);
      if (!identity) {
        identity = new Identity({
          id: id,
          clientId: this.appId,
          userId: id.substring(20)
        });
      }
      identity.unfollow();
      return identity;
    }

    /**
     * Takes as input an object id, and either calls getConversation() or getMessage() as needed.
     *
     * Will only get cached objects, will not get objects from the server.
     *
     * This is not a public method mostly so there's no ambiguity over using getXXX
     * or _getObject.  getXXX typically has an option to load the resource, which this
     * does not.
     *
     * @method _getObject
     * @protected
     * @param  {string} id - Message, Conversation or Query id
     * @return {layer.Message|layer.Conversation|layer.Query}
     */

  }, {
    key: '_getObject',
    value: function _getObject(id) {
      switch (Util.typeFromID(id)) {
        case 'messages':
        case 'announcements':
          return this.getMessage(id);
        case 'conversations':
          return this.getConversation(id);
        case 'queries':
          return this.getQuery(id);
        case 'identities':
          return this.getIdentity(id);
      }
      return null;
    }

    /**
     * Takes an object description from the server and either updates it (if cached)
     * or creates and caches it .
     *
     * @method _createObject
     * @protected
     * @param  {Object} obj - Plain javascript object representing a Message or Conversation
     */

  }, {
    key: '_createObject',
    value: function _createObject(obj) {
      var item = this._getObject(obj.id);
      if (item) {
        item._populateFromServer(obj);
        return item;
      } else {
        switch (Util.typeFromID(obj.id)) {
          case 'messages':
            return Message._createFromServer(obj, this);
          case 'announcements':
            return Announcement._createFromServer(obj, this);
          case 'conversations':
            return Conversation._createFromServer(obj, this);
          case 'identities':
            return Identity._createFromServer(obj, this);
        }
      }
      return null;
    }

    /**
     * Merge events into smaller numbers of more complete events.
     *
     * Before any delayed triggers are fired, fold together all of the conversations:add
     * and conversations:remove events so that 100 conversations:add events can be fired as
     * a single event.
     *
     * @method _processDelayedTriggers
     * @private
     */

  }, {
    key: '_processDelayedTriggers',
    value: function _processDelayedTriggers() {
      if (this.isDestroyed) return;

      var addConversations = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'conversations:add';
      });
      var removeConversations = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'conversations:remove';
      });
      this._foldEvents(addConversations, 'conversations', this);
      this._foldEvents(removeConversations, 'conversations', this);

      var addMessages = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'messages:add';
      });
      var removeMessages = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'messages:remove';
      });

      this._foldEvents(addMessages, 'messages', this);
      this._foldEvents(removeMessages, 'messages', this);

      var addIdentities = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'identities:add';
      });
      var removeIdentities = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'identities:remove';
      });

      this._foldEvents(addIdentities, 'identities', this);
      this._foldEvents(removeIdentities, 'identities', this);

      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), '_processDelayedTriggers', this).call(this);
    }
  }, {
    key: 'trigger',
    value: function trigger(eventName, evt) {
      this._triggerLogger(eventName, evt);
      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), 'trigger', this).call(this, eventName, evt);
    }

    /**
     * Does logging on all triggered events.
     *
     * All logging is done at `debug` or `info` levels.
     *
     * @method _triggerLogger
     * @private
     */

  }, {
    key: '_triggerLogger',
    value: function _triggerLogger(eventName, evt) {
      var infoEvents = ['conversations:add', 'conversations:remove', 'conversations:change', 'messages:add', 'messages:remove', 'messages:change', 'identities:add', 'identities:remove', 'identities:change', 'challenge', 'ready'];
      if (infoEvents.indexOf(eventName) !== -1) {
        if (evt && evt.isChange) {
          logger.info('Client Event: ' + eventName + ' ' + evt.changes.map(function (change) {
            return change.property;
          }).join(', '));
        } else {
          var text = '';
          if (evt) {
            if (evt.message) text = evt.message.id;
            if (evt.messages) text = evt.messages.length + ' messages';
            if (evt.conversation) text = evt.conversation.id;
            if (evt.conversations) text = evt.conversations.length + ' conversations';
          }
          logger.info('Client Event: ' + eventName + ' ' + text);
        }
        if (evt) logger.debug(evt);
      } else {
        logger.debug(eventName, evt);
      }
    }

    /**
     * Searches locally cached conversations for a matching conversation.
     *
     * Iterates over conversations calling a matching function until
     * the conversation is found or all conversations tested.
     *
     *      var c = client.findConversation(function(conversation) {
     *          if (conversation.participants.indexOf('a') != -1) return true;
     *      });
     *
     * @method findCachedConversation
     * @param  {Function} f - Function to call until we find a match
     * @param  {layer.Conversation} f.conversation - A conversation to test
     * @param  {boolean} f.return - Return true if the conversation is a match
     * @param  {Object} [context] - Optional context for the *this* object
     * @return {layer.Conversation}
     *
     * @deprecated
     * This should be replaced by iterating over your layer.Query data.
     */

  }, {
    key: 'findCachedConversation',
    value: function findCachedConversation(func, context) {
      var test = context ? func.bind(context) : func;
      var list = Object.keys(this._conversationsHash);
      var len = list.length;
      for (var index = 0; index < len; index++) {
        var key = list[index];
        var conversation = this._conversationsHash[key];
        if (test(conversation, index)) return conversation;
      }
      return null;
    }

    /**
     * If the session has been reset, dump all data.
     *
     * @method _resetSession
     * @private
     */

  }, {
    key: '_resetSession',
    value: function _resetSession() {
      this._cleanup();
      this._conversationsHash = {};
      this._messagesHash = {};
      this._queriesHash = {};
      this._identitiesHash = {};
      return _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), '_resetSession', this).call(this);
    }

    /**
     * This method is recommended way to create a Conversation.
     *
     * There are a few ways to invoke it; note that the default behavior is to create a Distinct Conversation
     * unless otherwise stated via the layer.Conversation.distinct property.
     *
     *         client.createConversation({participants: ['a', 'b']});
     *         client.createConversation({participants: [userIdentityA, userIdentityB]});
     *
     *         client.createConversation({
     *             participants: ['a', 'b'],
     *             distinct: false
     *         });
     *
     *         client.createConversation({
     *             participants: ['a', 'b'],
     *             metadata: {
     *                 title: 'I am a title'
     *             }
     *         });
     *
     * If you try to create a Distinct Conversation that already exists,
     * you will get back an existing Conversation, and any requested metadata
     * will NOT be set; you will get whatever metadata the matching Conversation
     * already had.
     *
     * The default value for distinct is `true`.
     *
     * Whether the Conversation already exists or not, a 'conversations:sent' event
     * will be triggered asynchronously and the Conversation object will be ready
     * at that time.  Further, the event will provide details on the result:
     *
     *       var conversation = client.createConversation({
     *          participants: ['a', 'b'],
     *          metadata: {
     *            title: 'I am a title'
     *          }
     *       });
     *       conversation.on('conversations:sent', function(evt) {
     *           switch(evt.result) {
     *               case Conversation.CREATED:
     *                   alert(conversation.id + ' was created');
     *                   break;
     *               case Conversation.FOUND:
     *                   alert(conversation.id + ' was found');
     *                   break;
     *               case Conversation.FOUND_WITHOUT_REQUESTED_METADATA:
     *                   alert(conversation.id + ' was found but it already has a title so your requested title was not set');
     *                   break;
     *            }
     *       });
     *
     * Warning: This method will throw an error if called when you are not (or are no longer) an authenticated user.
     * That means if authentication has expired, and you have not yet reauthenticated the user, this will throw an error.
     *
     *
     * @method createConversation
     * @param  {Object} options
     * @param {string[]/layer.Identity[]} participants - Array of UserIDs or UserIdentities
     * @param {Boolean} [options.distinct=true] Is this a distinct Converation?
     * @param {Object} [options.metadata={}] Metadata for your Conversation
     * @return {layer.Conversation}
     */

  }, {
    key: 'createConversation',
    value: function createConversation(options) {
      // If we aren't authenticated, then we don't yet have a UserID, and won't create the correct Conversation
      if (!this.isAuthenticated) throw new Error(ErrorDictionary.clientMustBeReady);
      if (!('distinct' in options)) options.distinct = true;
      options.client = this;
      return Conversation.create(options);
    }

    /**
     * Retrieve the query by query id.
     *
     * Useful for finding a Query when you only have the ID
     *
     * @method getQuery
     * @param  {string} id              - layer:///messages/uuid
     * @return {layer.Query}
     */

  }, {
    key: 'getQuery',
    value: function getQuery(id) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      return this._queriesHash[id] || null;
    }

    /**
     * There are two options to create a new layer.Query instance.
     *
     * The direct way:
     *
     *     var query = client.createQuery({
     *         model: layer.Query.Message,
     *         predicate: 'conversation.id = '' + conv.id + ''',
     *         paginationWindow: 50
     *     });
     *
     * A Builder approach that allows for a simpler syntax:
     *
     *     var qBuilder = QueryBuilder
     *      .messages()
     *      .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
     *      .paginationWindow(100);
     *     var query = client.createQuery(qBuilder);
     *
     * @method createQuery
     * @param  {layer.QueryBuilder|Object} options - Either a layer.QueryBuilder instance, or parameters for the layer.Query constructor
     * @return {layer.Query}
     */

  }, {
    key: 'createQuery',
    value: function createQuery(options) {
      var query = void 0;
      if (typeof options.build === 'function') {
        query = new Query(this, options);
      } else {
        options.client = this;
        query = new Query(options);
      }
      this._addQuery(query);
      return query;
    }

    /**
     * Register the layer.Query.
     *
     * @method _addQuery
     * @private
     * @param  {layer.Query} query
     */

  }, {
    key: '_addQuery',
    value: function _addQuery(query) {
      this._queriesHash[query.id] = query;
    }

    /**
     * Deregister the layer.Query.
     *
     * @method _removeQuery
     * @private
     * @param  {layer.Query} query [description]
     */

  }, {
    key: '_removeQuery',
    value: function _removeQuery(query) {
      var _this9 = this;

      if (query) {
        delete this._queriesHash[query.id];
        if (!this._inCleanup) {
          var data = query.data.map(function (obj) {
            return _this9._getObject(obj.id);
          }).filter(function (obj) {
            return obj;
          });
          this._checkAndPurgeCache(data);
        }
        this.off(null, null, query);
      }
    }

    /**
     * Check to see if the specified objects can safely be removed from cache.
     *
     * Removes from cache if an object is not part of any Query's result set.
     *
     * @method _checkAndPurgeCache
     * @private
     * @param  {layer.Root[]} objects - Array of Messages or Conversations
     */

  }, {
    key: '_checkAndPurgeCache',
    value: function _checkAndPurgeCache(objects) {
      var _this10 = this;

      objects.forEach(function (obj) {
        if (!obj.isDestroyed && !_this10._isCachedObject(obj)) {
          if (obj instanceof Root === false) obj = _this10._getObject(obj.id);
          if (obj) obj.destroy();
        }
      });
    }

    /**
     * Schedules _runScheduledCheckAndPurgeCache if needed, and adds this object
     * to the list of objects it will validate for uncaching.
     *
     * Note that any object that does not exist on the server (!isSaved()) is an object that the
     * app created and can only be purged by the app and not by the SDK.  Once its been
     * saved, and can be reloaded from the server when needed, its subject to standard caching.
     *
     * @method _scheduleCheckAndPurgeCache
     * @private
     * @param {layer.Root} object
     */

  }, {
    key: '_scheduleCheckAndPurgeCache',
    value: function _scheduleCheckAndPurgeCache(object) {
      var _this11 = this;

      if (object.isSaved()) {
        if (this._scheduleCheckAndPurgeCacheAt < Date.now()) {
          this._scheduleCheckAndPurgeCacheAt = Date.now() + Client.CACHE_PURGE_INTERVAL;
          setTimeout(function () {
            return _this11._runScheduledCheckAndPurgeCache();
          }, Client.CACHE_PURGE_INTERVAL);
        }
        this._scheduleCheckAndPurgeCacheItems.push(object);
      }
    }

    /**
     * Calls _checkAndPurgeCache on accumulated objects and resets its state.
     *
     * @method _runScheduledCheckAndPurgeCache
     * @private
     */

  }, {
    key: '_runScheduledCheckAndPurgeCache',
    value: function _runScheduledCheckAndPurgeCache() {
      var list = this._scheduleCheckAndPurgeCacheItems;
      this._scheduleCheckAndPurgeCacheItems = [];
      this._checkAndPurgeCache(list);
      this._scheduleCheckAndPurgeCacheAt = 0;
    }

    /**
     * Returns true if the specified object should continue to be part of the cache.
     *
     * Result is based on whether the object is part of the data for a Query.
     *
     * @method _isCachedObject
     * @private
     * @param  {layer.Root} obj - A Message or Conversation Instance
     * @return {Boolean}
     */

  }, {
    key: '_isCachedObject',
    value: function _isCachedObject(obj) {
      var list = Object.keys(this._queriesHash);
      for (var i = 0; i < list.length; i++) {
        var query = this._queriesHash[list[i]];
        if (query._getItem(obj.id)) return true;
      }
      return false;
    }

    /**
     * On restoring a connection, determine what steps need to be taken to update our data.
     *
     * A reset boolean property is passed; set based on  layer.ClientAuthenticator.ResetAfterOfflineDuration.
     *
     * Note it is possible for an application to have logic that causes queries to be created/destroyed
     * as a side-effect of layer.Query.reset destroying all data. So we must test to see if queries exist.
     *
     * @method _connectionRestored
     * @private
     * @param {boolean} reset - Should the session reset/reload all data or attempt to resume where it left off?
     */

  }, {
    key: '_connectionRestored',
    value: function _connectionRestored(evt) {
      var _this12 = this;

      if (evt.reset) {
        logger.debug('Client Connection Restored; Resetting all Queries');
        this.dbManager.deleteTables(function () {
          _this12.dbManager._open();
          Object.keys(_this12._queriesHash).forEach(function (id) {
            var query = _this12._queriesHash[id];
            if (query) query.reset();
          });
        });
      }
    }

    /**
     * Remove the specified object from cache
     *
     * @method _removeObject
     * @private
     * @param  {layer.Root}  obj - A Message or Conversation Instance
     */

  }, {
    key: '_removeObject',
    value: function _removeObject(obj) {
      if (obj) obj.destroy();
    }

    /**
     * Creates a layer.TypingIndicators.TypingListener instance
     * bound to the specified dom node.
     *
     *      var typingListener = client.createTypingListener(document.getElementById('myTextBox'));
     *      typingListener.setConversation(mySelectedConversation);
     *
     * Use this method to instantiate a listener, and call
     * layer.TypingIndicators.TypingListener.setConversation every time you want to change which Conversation
     * it reports your user is typing into.
     *
     * @method createTypingListener
     * @param  {HTMLElement} inputNode - Text input to watch for keystrokes
     * @return {layer.TypingIndicators.TypingListener}
     */

  }, {
    key: 'createTypingListener',
    value: function createTypingListener(inputNode) {
      var TypingListener = require('./typing-indicators/typing-listener');
      return new TypingListener({
        clientId: this.appId,
        input: inputNode
      });
    }

    /**
     * Creates a layer.TypingIndicators.TypingPublisher.
     *
     * The TypingPublisher lets you manage your Typing Indicators without using
     * the layer.TypingIndicators.TypingListener.
     *
     *      var typingPublisher = client.createTypingPublisher();
     *      typingPublisher.setConversation(mySelectedConversation);
     *      typingPublisher.setState(layer.TypingIndicators.STARTED);
     *
     * Use this method to instantiate a listener, and call
     * layer.TypingIndicators.TypingPublisher.setConversation every time you want to change which Conversation
     * it reports your user is typing into.
     *
     * Use layer.TypingIndicators.TypingPublisher.setState to inform other users of your current state.
     * Note that the `STARTED` state only lasts for 2.5 seconds, so you
     * must repeatedly call setState for as long as this state should continue.
     * This is typically done by simply calling it every time a user hits
     * a key.
     *
     * @method createTypingPublisher
     * @return {layer.TypingIndicators.TypingPublisher}
     */

  }, {
    key: 'createTypingPublisher',
    value: function createTypingPublisher() {
      var TypingPublisher = require('./typing-indicators/typing-publisher');
      return new TypingPublisher({
        clientId: this.appId
      });
    }

    /**
     * Get the current typing indicator state of a specified Conversation.
     *
     * Typically used to see if anyone is currently typing when first opening a Conversation.
     *
     * @method getTypingState
     * @param {String} conversationId
     */

  }, {
    key: 'getTypingState',
    value: function getTypingState(conversationId) {
      return this._typingIndicators.getState(conversationId);
    }

    /**
     * Accessor for getting a Client by appId.
     *
     * Most apps will only have one client,
     * and will not need this method.
     *
     * @method getClient
     * @static
     * @param  {string} appId
     * @return {layer.Client}
     */

  }], [{
    key: 'getClient',
    value: function getClient(appId) {
      return ClientRegistry.get(appId);
    }
  }, {
    key: 'destroyAllClients',
    value: function destroyAllClients() {
      ClientRegistry.getAll().forEach(function (client) {
        return client.destroy();
      });
    }

    /*
     * Registers a plugin which can add capabilities to the Client.
     *
     * Capabilities must be triggered by Events/Event Listeners.
     *
     * This concept is a bit premature and unused/untested...
     * As implemented, it provides for a plugin that will be
     * instantiated by the Client and passed the Client as its parameter.
     * This allows for a library of plugins that can be shared among
     * different companies/projects but that are outside of the core
     * app logic.
     *
     *      // Define the plugin
     *      function MyPlugin(client) {
     *          this.client = client;
     *          client.on('messages:add', this.onMessagesAdd, this);
     *      }
     *
     *      MyPlugin.prototype.onMessagesAdd = function(event) {
     *          var messages = event.messages;
     *          alert('You now have ' + messages.length  + ' messages');
     *      }
     *
     *      // Register the Plugin
     *      Client.registerPlugin('myPlugin34', MyPlugin);
     *
     *      var client = new Client({appId: 'layer:///apps/staging/uuid'});
     *
     *      // Trigger the plugin's behavior
     *      client.myPlugin34.addMessages({messages:[]});
     *
     * @method registerPlugin
     * @static
     * @param  {string} name     [description]
     * @param  {Function} classDef [description]
     */

  }, {
    key: 'registerPlugin',
    value: function registerPlugin(name, classDef) {
      Client.plugins[name] = classDef;
    }
  }]);

  return Client;
}(ClientAuth);

/**
 * Hash of layer.Conversation objects for quick lookup by id
 *
 * @private
 * @property {Object}
 */


Client.prototype._conversationsHash = null;

/**
 * Hash of layer.Message objects for quick lookup by id
 *
 * @private
 * @type {Object}
 */
Client.prototype._messagesHash = null;

/**
 * Hash of layer.Query objects for quick lookup by id
 *
 * @private
 * @type {Object}
 */
Client.prototype._queriesHash = null;

/**
 * Array of items to be checked to see if they can be uncached.
 *
 * @private
 * @type {layer.Root[]}
 */
Client.prototype._scheduleCheckAndPurgeCacheItems = null;

/**
 * Time that the next call to _runCheckAndPurgeCache() is scheduled for in ms since 1970.
 *
 * @private
 * @type {number}
 */
Client.prototype._scheduleCheckAndPurgeCacheAt = 0;

/**
 * Get the version of the Client library.
 *
 * @static
 * @type {String}
 */
Client.version = '3.0.0';

/**
 * Any Conversation or Message that is part of a Query's results are kept in memory for as long as it
 * remains in that Query.  However, when a websocket event delivers new Messages and Conversations that
 * are NOT part of a Query, how long should they stick around in memory?  Why have them stick around?
 * Perhaps an app wants to post a notification of a new Message or Conversation... and wants to keep
 * the object local for a little while.  Default is 10 minutes before checking to see if
 * the object is part of a Query or can be uncached.  Value is in miliseconds.
 * @static
 * @type {number}
 */
Client.CACHE_PURGE_INTERVAL = 10 * 60 * 1000;

Client._ignoredEvents = ['conversations:loaded', 'conversations:loaded-error'];

Client._supportedEvents = [

/**
 * One or more layer.Conversation objects have been added to the client.
 *
 * They may have been added via the websocket, or via the user creating
 * a new Conversation locally.
 *
 *      client.on('conversations:add', function(evt) {
 *          evt.conversations.forEach(function(conversation) {
 *              myView.addConversation(conversation);
 *          });
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation[]} evt.conversations - Array of conversations added
 */
'conversations:add',

/**
 * One or more layer.Conversation objects have been removed.
 *
 * A removed Conversation is not necessarily deleted, its just
 * no longer being held in local memory.
 *
 * Note that typically you will want the conversations:delete event
 * rather than conversations:remove.
 *
 *      client.on('conversations:remove', function(evt) {
 *          evt.conversations.forEach(function(conversation) {
 *              myView.removeConversation(conversation);
 *          });
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation[]} evt.conversations - Array of conversations removed
 */
'conversations:remove',

/**
 * The conversation is now on the server.
 *
 * Called after creating the conversation
 * on the server.  The Result property is one of:
 *
 * * layer.Conversation.CREATED: A new Conversation has been created
 * * layer.Conversation.FOUND: A matching Distinct Conversation has been found
 * * layer.Conversation.FOUND_WITHOUT_REQUESTED_METADATA: A matching Distinct Conversation has been found
 *                       but note that the metadata is NOT what you requested.
 *
 * All of these results will also mean that the updated property values have been
 * copied into your Conversation object.  That means your metadata property may no
 * longer be its initial value; it will be the value found on the server.
 *
 *      client.on('conversations:sent', function(evt) {
 *          switch(evt.result) {
 *              case Conversation.CREATED:
 *                  alert(evt.target.id + ' Created!');
 *                  break;
 *              case Conversation.FOUND:
 *                  alert(evt.target.id + ' Found!');
 *                  break;
 *              case Conversation.FOUND_WITHOUT_REQUESTED_METADATA:
 *                  alert(evt.target.id + ' Found, but does not have the requested metadata!');
 *                  break;
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {string} event.result
 * @param {layer.Conversation} target
 */
'conversations:sent',

/**
 * A conversation failed to load or create on the server.
 *
 *      client.on('conversations:sent-error', function(evt) {
 *          alert(evt.data.message);
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.data
 * @param {layer.Conversation} target
 */
'conversations:sent-error',

/**
 * A conversation had a change in its properties.
 *
 * This change may have been delivered from a remote user
 * or as a result of a local operation.
 *
 *      client.on('conversations:change', function(evt) {
 *          var metadataChanges = evt.getChangesFor('metadata');
 *          var participantChanges = evt.getChangesFor('participants');
 *          if (metadataChanges.length) {
 *              myView.renderTitle(evt.target.metadata.title);
 *          }
 *          if (participantChanges.length) {
 *              myView.renderParticipants(evt.target.participants);
 *          }
 *      });
 *
 * NOTE: Typically such rendering is done using Events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation} evt.target
 * @param {Object[]} evt.changes
 * @param {Mixed} evt.changes.newValue
 * @param {Mixed} evt.changes.oldValue
 * @param {string} evt.changes.property - Name of the property that has changed
 */
'conversations:change',

/**
 * A call to layer.Conversation.load has completed successfully
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation} evt.target
 */
'conversations:loaded',

/**
 * A new message has been received for which a notification may be suitable.
 *
 * This event is triggered for messages that are:
 *
 * 1. Added via websocket rather than other IO
 * 2. Not yet been marked as read
 * 3. Not sent by this user
 *
        client.on('messages:notify', function(evt) {
            myNotify(evt.message);
        })
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.Message
 */
'messages:notify',

/**
 * Messages have been added to a conversation.
 *
 * May also fire when new Announcements are received.
 *
 * This event is triggered on
 *
 * * creating/sending a new message
 * * Receiving a new layer.Message or layer.Announcement via websocket
 * * Querying/downloading a set of Messages
 *
        client.on('messages:add', function(evt) {
            evt.messages.forEach(function(message) {
                myView.addMessage(message);
            });
        });
 *
 * NOTE: Such rendering would typically be done using events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message[]} evt.messages
 */
'messages:add',

/**
 * A message has been removed from a conversation.
 *
 * A removed Message is not necessarily deleted,
 * just no longer being held in memory.
 *
 * Note that typically you will want the messages:delete event
 * rather than messages:remove.
 *
 *      client.on('messages:remove', function(evt) {
 *          evt.messages.forEach(function(message) {
 *              myView.removeMessage(message);
 *          });
 *      });
 *
 * NOTE: Such rendering would typically be done using events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.message
 */
'messages:remove',

/**
 * A message has been sent.
 *
 *      client.on('messages:sent', function(evt) {
 *          alert(evt.target.getText() + ' has been sent');
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:sent',

/**
 * A message is about to be sent.
 *
 * Useful if you want to
 * add parts to the message before it goes out.
 *
 *      client.on('messages:sending', function(evt) {
 *          evt.target.addPart({
 *              mimeType: 'text/plain',
 *              body: 'this is just a test'
 *          });
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:sending',

/**
 * Server failed to receive a Message.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.error
 */
'messages:sent-error',

/**
 * A message has had a change in its properties.
 *
 * This change may have been delivered from a remote user
 * or as a result of a local operation.
 *
 *      client.on('messages:change', function(evt) {
 *          var recpientStatusChanges = evt.getChangesFor('recipientStatus');
 *          if (recpientStatusChanges.length) {
 *              myView.renderStatus(evt.target);
 *          }
 *      });
 *
 * NOTE: Such rendering would typically be done using events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 * @param {Object[]} evt.changes
 * @param {Mixed} evt.changes.newValue
 * @param {Mixed} evt.changes.oldValue
 * @param {string} evt.changes.property - Name of the property that has changed
 */
'messages:change',

/**
 * A call to layer.Message.load has completed successfully
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:loaded',

/**
 * A Conversation has been deleted from the server.
 *
 * Caused by either a successful call to layer.Conversation.delete() on the Conversation
 * or by a remote user.
 *
 *      client.on('conversations:delete', function(evt) {
 *          myView.removeConversation(evt.target);
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation} evt.target
 */
'conversations:delete',

/**
 * A Message has been deleted from the server.
 *
 * Caused by either a successful call to layer.Message.delete() on the Message
 * or by a remote user.
 *
 *      client.on('messages:delete', function(evt) {
 *          myView.removeMessage(evt.target);
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:delete',

/**
 * A call to layer.Identity.load has completed successfully
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'identities:loaded',

/**
 * An Identity has had a change in its properties.
 *
 * Changes occur when new data arrives from the server.
 *
 *      client.on('identities:change', function(evt) {
 *          var displayNameChanges = evt.getChangesFor('displayName');
 *          if (displayNameChanges.length) {
 *              myView.renderStatus(evt.target);
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 * @param {Object[]} evt.changes
 * @param {Mixed} evt.changes.newValue
 * @param {Mixed} evt.changes.oldValue
 * @param {string} evt.changes.property - Name of the property that has changed
 */
'identities:change',

/**
 * Identities have been added to the Client.
 *
 * This event is triggered whenever a new layer.Identity (Full identity or not)
 * has been received by the Client.
 *
        client.on('identities:add', function(evt) {
            evt.identities.forEach(function(identity) {
                myView.addIdentity(identity);
            });
        });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity[]} evt.identities
 */
'identities:add',

/**
 * Identities have been removed from the Client.
 *
 * This does not typically occur.
 *
        client.on('identities:remove', function(evt) {
            evt.identities.forEach(function(identity) {
                myView.addIdentity(identity);
            });
        });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity[]} evt.identities
 */
'identities:remove',

/**
 * An Identity has been unfollowed or deleted.
 *
 * We do not delete such Identities entirely from the Client as
 * there are still Messages from these Identities to be rendered,
 * but we do downgrade them from Full Identity to Basic Identity.
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity} evt.target
 */
'identities:unfollow',

/**
 * A Typing Indicator state has changed.
 *
 * Either a change has been received
 * from the server, or a typing indicator state has expired.
 *
 *      client.on('typing-indicator-change', function(evt) {
 *          if (evt.conversationId === myConversationId) {
 *              alert(evt.typing.join(', ') + ' are typing');
 *              alert(evt.paused.join(', ') + ' are paused');
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {string} conversationId - ID of the Conversation users are typing into
 * @param {string[]} typing - Array of user IDs who are currently typing
 * @param {string[]} paused - Array of user IDs who are currently paused;
 *                            A paused user still has text in their text box.
 */
'typing-indicator-change'].concat(ClientAuth._supportedEvents);

Client.plugins = {};

Root.initClass.apply(Client, [Client, 'Client']);
module.exports = Client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQuanMiXSwibmFtZXMiOlsiQ2xpZW50QXV0aCIsInJlcXVpcmUiLCJDb252ZXJzYXRpb24iLCJRdWVyeSIsIkVycm9yRGljdGlvbmFyeSIsImRpY3Rpb25hcnkiLCJTeW5jYWJsZSIsIk1lc3NhZ2UiLCJBbm5vdW5jZW1lbnQiLCJJZGVudGl0eSIsIlR5cGluZ0luZGljYXRvckxpc3RlbmVyIiwiVXRpbCIsIlJvb3QiLCJDbGllbnRSZWdpc3RyeSIsImxvZ2dlciIsIkNsaWVudCIsIm9wdGlvbnMiLCJyZWdpc3RlciIsIl9jb252ZXJzYXRpb25zSGFzaCIsIl9tZXNzYWdlc0hhc2giLCJfcXVlcmllc0hhc2giLCJfaWRlbnRpdGllc0hhc2giLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyIsIl9pbml0Q29tcG9uZW50cyIsIm9uIiwiX2Nvbm5lY3Rpb25SZXN0b3JlZCIsImJpbmQiLCJpbmZvIiwiYXNjaWlJbml0IiwidmVyc2lvbiIsIl90eXBpbmdJbmRpY2F0b3JzIiwiY2xpZW50SWQiLCJhcHBJZCIsIk9iamVjdCIsImtleXMiLCJwbHVnaW5zIiwiZm9yRWFjaCIsInByb3BlcnR5TmFtZSIsImlzRGVzdHJveWVkIiwiX2luQ2xlYW51cCIsImMiLCJpZCIsImRlc3Ryb3kiLCJtIiwiaWRlbnRpdHkiLCJzb2NrZXRNYW5hZ2VyIiwiY2xvc2UiLCJfY2xlYW51cCIsIl9kZXN0cm95Q29tcG9uZW50cyIsInVucmVnaXN0ZXIiLCJFcnJvciIsImFwcElkSW1tdXRhYmxlIiwiY2FuTG9hZCIsImlkUGFyYW1SZXF1aXJlZCIsImxvYWQiLCJjb252ZXJzYXRpb24iLCJfdHJpZ2dlckFzeW5jIiwiY29udmVyc2F0aW9ucyIsIl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZSIsIm9mZiIsImNvbnZlcnNhdGlvbklkIiwib2xkSWQiLCJmaWx0ZXIiLCJtZXNzYWdlSWQiLCJyZXBsYWNlIiwibWVzc2FnZSIsImdldE1lc3NhZ2UiLCJnZXRQYXJ0QnlJZCIsIm1lc3NhZ2VzIiwiX25vdGlmeSIsImdldENvbnZlcnNhdGlvbiIsImxhc3RNZXNzYWdlIiwicG9zaXRpb24iLCJsYXN0TWVzc2FnZVdhcyIsImNvbnYiLCJmcm9tUG9zaXRpb24iLCJtSWQiLCJpc1ZhbGlkSWQiLCJwcmVmaXhVVUlEIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiaWRlbnRpdGllcyIsIm1hcCIsImdldElkZW50aXR5IiwidXNlcklkIiwiX2NyZWF0ZU9iamVjdCIsInN1YnN0cmluZyIsImZvbGxvdyIsInVuZm9sbG93IiwidHlwZUZyb21JRCIsImdldFF1ZXJ5Iiwib2JqIiwiaXRlbSIsIl9nZXRPYmplY3QiLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwiX2NyZWF0ZUZyb21TZXJ2ZXIiLCJhZGRDb252ZXJzYXRpb25zIiwiX2RlbGF5ZWRUcmlnZ2VycyIsImV2dCIsInJlbW92ZUNvbnZlcnNhdGlvbnMiLCJfZm9sZEV2ZW50cyIsImFkZE1lc3NhZ2VzIiwicmVtb3ZlTWVzc2FnZXMiLCJhZGRJZGVudGl0aWVzIiwicmVtb3ZlSWRlbnRpdGllcyIsImV2ZW50TmFtZSIsIl90cmlnZ2VyTG9nZ2VyIiwiaW5mb0V2ZW50cyIsImluZGV4T2YiLCJpc0NoYW5nZSIsImNoYW5nZXMiLCJjaGFuZ2UiLCJwcm9wZXJ0eSIsImpvaW4iLCJ0ZXh0IiwibGVuZ3RoIiwiZGVidWciLCJmdW5jIiwiY29udGV4dCIsInRlc3QiLCJsaXN0IiwibGVuIiwiaW5kZXgiLCJrZXkiLCJpc0F1dGhlbnRpY2F0ZWQiLCJjbGllbnRNdXN0QmVSZWFkeSIsImRpc3RpbmN0IiwiY2xpZW50IiwiY3JlYXRlIiwicXVlcnkiLCJidWlsZCIsIl9hZGRRdWVyeSIsImRhdGEiLCJfY2hlY2tBbmRQdXJnZUNhY2hlIiwib2JqZWN0cyIsIl9pc0NhY2hlZE9iamVjdCIsIm9iamVjdCIsImlzU2F2ZWQiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCIsIkRhdGUiLCJub3ciLCJDQUNIRV9QVVJHRV9JTlRFUlZBTCIsInNldFRpbWVvdXQiLCJfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlIiwicHVzaCIsImkiLCJfZ2V0SXRlbSIsInJlc2V0IiwiZGJNYW5hZ2VyIiwiZGVsZXRlVGFibGVzIiwiX29wZW4iLCJpbnB1dE5vZGUiLCJUeXBpbmdMaXN0ZW5lciIsImlucHV0IiwiVHlwaW5nUHVibGlzaGVyIiwiZ2V0U3RhdGUiLCJnZXQiLCJnZXRBbGwiLCJuYW1lIiwiY2xhc3NEZWYiLCJwcm90b3R5cGUiLCJfaWdub3JlZEV2ZW50cyIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUErRUEsSUFBTUEsYUFBYUMsUUFBUSx3QkFBUixDQUFuQjtBQUNBLElBQU1DLGVBQWVELFFBQVEsZ0JBQVIsQ0FBckI7QUFDQSxJQUFNRSxRQUFRRixRQUFRLFNBQVIsQ0FBZDtBQUNBLElBQU1HLGtCQUFrQkgsUUFBUSxlQUFSLEVBQXlCSSxVQUFqRDtBQUNBLElBQU1DLFdBQVdMLFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU1NLFVBQVVOLFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU1PLGVBQWVQLFFBQVEsZ0JBQVIsQ0FBckI7QUFDQSxJQUFNUSxXQUFXUixRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNUywwQkFBMEJULFFBQVEsK0NBQVIsQ0FBaEM7QUFDQSxJQUFNVSxPQUFPVixRQUFRLGdCQUFSLENBQWI7QUFDQSxJQUFNVyxPQUFPWCxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU1ZLGlCQUFpQlosUUFBUSxtQkFBUixDQUF2QjtBQUNBLElBQU1hLFNBQVNiLFFBQVEsVUFBUixDQUFmOztJQUVNYyxNOzs7QUFFSjs7OztBQUlBLGtC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QkF0Wk0sQ0FBMUI7O0FBd1pBbEosT0FBT29CLE9BQVAsR0FBaUIsRUFBakI7O0FBRUF2QixLQUFLdUosU0FBTCxDQUFlQyxLQUFmLENBQXFCckosTUFBckIsRUFBNkIsQ0FBQ0EsTUFBRCxFQUFTLFFBQVQsQ0FBN0I7QUFDQXNKLE9BQU9DLE9BQVAsR0FBaUJ2SixNQUFqQiIsImZpbGUiOiJjbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBMYXllciBDbGllbnQ7IHRoaXMgaXMgdGhlIHRvcCBsZXZlbCBjb21wb25lbnQgZm9yIGFueSBMYXllciBiYXNlZCBhcHBsaWNhdGlvbi5cblxuICAgIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHtcbiAgICAgIGFwcElkOiAnbGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZicsXG4gICAgICBjaGFsbGVuZ2U6IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICBteUF1dGhlbnRpY2F0b3Ioe1xuICAgICAgICAgIG5vbmNlOiBldnQubm9uY2UsXG4gICAgICAgICAgb25TdWNjZXNzOiBldnQuY2FsbGJhY2tcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgcmVhZHk6IGZ1bmN0aW9uKGNsaWVudCkge1xuICAgICAgICBhbGVydCgnSSBhbSBDbGllbnQ7IFNlcnZlcjogU2VydmUgbWUhJyk7XG4gICAgICB9XG4gICAgfSkuY29ubmVjdCgnRnJlZCcpXG4gKlxuICogWW91IGNhbiBhbHNvIGluaXRpYWxpemUgdGhpcyBhc1xuXG4gICAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICAgICAgYXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJ1xuICAgIH0pO1xuXG4gICAgY2xpZW50Lm9uKCdjaGFsbGVuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgIG15QXV0aGVudGljYXRvcih7XG4gICAgICAgIG5vbmNlOiBldnQubm9uY2UsXG4gICAgICAgIG9uU3VjY2VzczogZXZ0LmNhbGxiYWNrXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNsaWVudC5vbigncmVhZHknLCBmdW5jdGlvbihjbGllbnQpIHtcbiAgICAgIGFsZXJ0KCdJIGFtIENsaWVudDsgU2VydmVyOiBTZXJ2ZSBtZSEnKTtcbiAgICB9KTtcblxuICAgIGNsaWVudC5jb25uZWN0KCdGcmVkJyk7XG4gKlxuICogIyMgQVBJIFN5bm9wc2lzOlxuICpcbiAqIFRoZSBmb2xsb3dpbmcgUHJvcGVydGllcywgTWV0aG9kcyBhbmQgRXZlbnRzIGFyZSB0aGUgbW9zdCBjb21tb25seSB1c2VkIG9uZXMuICBTZWUgdGhlIGZ1bGwgQVBJIGJlbG93XG4gKiBmb3IgdGhlIHJlc3Qgb2YgdGhlIEFQSS5cbiAqXG4gKiAjIyMgUHJvcGVydGllczpcbiAqXG4gKiAqIGxheWVyLkNsaWVudC51c2VySWQ6IFVzZXIgSUQgb2YgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlclxuICogKiBsYXllci5DbGllbnQuYXBwSWQ6IFRoZSBJRCBmb3IgeW91ciBhcHBsaWNhdGlvblxuICpcbiAqXG4gKiAjIyMgTWV0aG9kczpcbiAqXG4gKiAqIGxheWVyLkNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oKTogQ3JlYXRlIGEgbmV3IGxheWVyLkNvbnZlcnNhdGlvbi5cbiAqICogbGF5ZXIuQ2xpZW50LmNyZWF0ZVF1ZXJ5KCk6IENyZWF0ZSBhIG5ldyBsYXllci5RdWVyeS5cbiAqICogbGF5ZXIuQ2xpZW50LmdldE1lc3NhZ2UoKTogSW5wdXQgYSBNZXNzYWdlIElELCBhbmQgb3V0cHV0IGEgbGF5ZXIuTWVzc2FnZSBvciBsYXllci5Bbm5vdW5jZW1lbnQgZnJvbSBjYWNoZS5cbiAqICogbGF5ZXIuQ2xpZW50LmdldENvbnZlcnNhdGlvbigpOiBJbnB1dCBhIENvbnZlcnNhdGlvbiBJRCwgYW5kIG91dHB1dCBhIGxheWVyLkNvbnZlcnNhdGlvbiBmcm9tIGNhY2hlLlxuICogKiBsYXllci5DbGllbnQub24oKSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLm9mZigpOiBldmVudCBsaXN0ZW5lcnNcbiAqICogbGF5ZXIuQ2xpZW50LmRlc3Ryb3koKTogQ2xlYW51cCBhbGwgcmVzb3VyY2VzIHVzZWQgYnkgdGhpcyBjbGllbnQsIGluY2x1ZGluZyBhbGwgTWVzc2FnZXMgYW5kIENvbnZlcnNhdGlvbnMuXG4gKlxuICogIyMjIEV2ZW50czpcbiAqXG4gKiAqIGBjaGFsbGVuZ2VgOiBQcm92aWRlcyBhIG5vbmNlIGFuZCBhIGNhbGxiYWNrOyB5b3UgY2FsbCB0aGUgY2FsbGJhY2sgb25jZSB5b3UgaGF2ZSBhbiBJZGVudGl0eSBUb2tlbi5cbiAqICogYHJlYWR5YDogWW91ciBhcHBsaWNhdGlvbiBjYW4gbm93IHN0YXJ0IHVzaW5nIHRoZSBMYXllciBzZXJ2aWNlc1xuICogKiBgbWVzc2FnZXM6bm90aWZ5YDogVXNlZCB0byBub3RpZnkgeW91ciBhcHBsaWNhdGlvbiBvZiBuZXcgbWVzc2FnZXMgZm9yIHdoaWNoIGEgbG9jYWwgbm90aWZpY2F0aW9uIG1heSBiZSBzdWl0YWJsZS5cbiAqXG4gKiAjIyBMb2dnaW5nOlxuICpcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyB0byBjaGFuZ2UgdGhlIGxvZyBsZXZlbCBmb3IgTGF5ZXIncyBsb2dnZXI6XG4gKlxuICogICAgIGxheWVyLkNsaWVudC5wcm90b3R5cGUubG9nTGV2ZWwgPSBsYXllci5Db25zdGFudHMuTE9HLklORk87XG4gKlxuICogb3JcbiAqXG4gKiAgICAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICogICAgICAgIGFwcElkOiAnbGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZicsXG4gKiAgICAgICAgbG9nTGV2ZWw6IGxheWVyLkNvbnN0YW50cy5MT0cuSU5GT1xuICogICAgIH0pO1xuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ2xpZW50XG4gKiBAZXh0ZW5kcyBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yXG4gKlxuICovXG5cbmNvbnN0IENsaWVudEF1dGggPSByZXF1aXJlKCcuL2NsaWVudC1hdXRoZW50aWNhdG9yJyk7XG5jb25zdCBDb252ZXJzYXRpb24gPSByZXF1aXJlKCcuL2NvbnZlcnNhdGlvbicpO1xuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5jb25zdCBFcnJvckRpY3Rpb25hcnkgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJykuZGljdGlvbmFyeTtcbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZScpO1xuY29uc3QgQW5ub3VuY2VtZW50ID0gcmVxdWlyZSgnLi9hbm5vdW5jZW1lbnQnKTtcbmNvbnN0IElkZW50aXR5ID0gcmVxdWlyZSgnLi9pZGVudGl0eScpO1xuY29uc3QgVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIgPSByZXF1aXJlKCcuL3R5cGluZy1pbmRpY2F0b3JzL3R5cGluZy1pbmRpY2F0b3ItbGlzdGVuZXInKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuL2NsaWVudC1yZWdpc3RyeScpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcblxuY2xhc3MgQ2xpZW50IGV4dGVuZHMgQ2xpZW50QXV0aCB7XG5cbiAgLypcbiAgICogQWRkcyBjb252ZXJzYXRpb25zLCBtZXNzYWdlcyBhbmQgd2Vic29ja2V0cyBvbiB0b3Agb2YgdGhlIGF1dGhlbnRpY2F0aW9uIGNsaWVudC5cbiAgICoganNkb2NzIG9uIHBhcmVudCBjbGFzcyBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBDbGllbnRSZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcblxuICAgIC8vIEluaXRpYWxpemUgUHJvcGVydGllc1xuICAgIHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoID0ge307XG4gICAgdGhpcy5fbWVzc2FnZXNIYXNoID0ge307XG4gICAgdGhpcy5fcXVlcmllc0hhc2ggPSB7fTtcbiAgICB0aGlzLl9pZGVudGl0aWVzSGFzaCA9IHt9O1xuICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMgPSBbXTtcblxuICAgIHRoaXMuX2luaXRDb21wb25lbnRzKCk7XG5cbiAgICB0aGlzLm9uKCdvbmxpbmUnLCB0aGlzLl9jb25uZWN0aW9uUmVzdG9yZWQuYmluZCh0aGlzKSk7XG5cbiAgICBsb2dnZXIuaW5mbyhVdGlsLmFzY2lpSW5pdChDbGllbnQudmVyc2lvbikpO1xuICB9XG5cbiAgLyogU2VlIHBhcmVudCBtZXRob2QgZG9jcyAqL1xuICBfaW5pdENvbXBvbmVudHMoKSB7XG4gICAgc3VwZXIuX2luaXRDb21wb25lbnRzKCk7XG5cbiAgICB0aGlzLl90eXBpbmdJbmRpY2F0b3JzID0gbmV3IFR5cGluZ0luZGljYXRvckxpc3RlbmVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgIH0pO1xuXG4gICAgLy8gSW5zdGFudGlhdGUgUGx1Z2luc1xuICAgIE9iamVjdC5rZXlzKENsaWVudC5wbHVnaW5zKS5mb3JFYWNoKHByb3BlcnR5TmFtZSA9PiB7XG4gICAgICB0aGlzW3Byb3BlcnR5TmFtZV0gPSBuZXcgQ2xpZW50LnBsdWdpbnNbcHJvcGVydHlOYW1lXSh0aGlzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbnVwIGFsbCByZXNvdXJjZXMgKENvbnZlcnNhdGlvbnMsIE1lc3NhZ2VzLCBldGMuLi4pIHByaW9yIHRvIGRlc3Ryb3kgb3IgcmVhdXRoZW50aWNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBfY2xlYW51cFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NsZWFudXAoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICB0aGlzLl9pbkNsZWFudXAgPSB0cnVlO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5fY29udmVyc2F0aW9uc0hhc2gpLmZvckVhY2goaWQgPT4ge1xuICAgICAgY29uc3QgYyA9IHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW2lkXTtcbiAgICAgIGlmIChjICYmICFjLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIGMuZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoID0gbnVsbDtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX21lc3NhZ2VzSGFzaCkuZm9yRWFjaChpZCA9PiB7XG4gICAgICBjb25zdCBtID0gdGhpcy5fbWVzc2FnZXNIYXNoW2lkXTtcbiAgICAgIGlmIChtICYmICFtLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIG0uZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX21lc3NhZ2VzSGFzaCA9IG51bGw7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLl9xdWVyaWVzSGFzaCkuZm9yRWFjaChpZCA9PiB7XG4gICAgICB0aGlzLl9xdWVyaWVzSGFzaFtpZF0uZGVzdHJveSgpO1xuICAgIH0pO1xuICAgIHRoaXMuX3F1ZXJpZXNIYXNoID0gbnVsbDtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX2lkZW50aXRpZXNIYXNoKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgY29uc3QgaWRlbnRpdHkgPSB0aGlzLl9pZGVudGl0aWVzSGFzaFtpZF07XG4gICAgICBpZiAoaWRlbnRpdHkgJiYgIWlkZW50aXR5LmlzRGVzdHJveWVkKSB7XG4gICAgICAgIGlkZW50aXR5LmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9pZGVudGl0aWVzSGFzaCA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5zb2NrZXRNYW5hZ2VyKSB0aGlzLnNvY2tldE1hbmFnZXIuY2xvc2UoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgLy8gQ2xlYW51cCBhbGwgcGx1Z2luc1xuICAgIE9iamVjdC5rZXlzKENsaWVudC5wbHVnaW5zKS5mb3JFYWNoKHByb3BlcnR5TmFtZSA9PiB7XG4gICAgICBpZiAodGhpc1twcm9wZXJ0eU5hbWVdKSB7XG4gICAgICAgIHRoaXNbcHJvcGVydHlOYW1lXS5kZXN0cm95KCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzW3Byb3BlcnR5TmFtZV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbGVhbnVwIGFsbCByZXNvdXJjZXMgKENvbnZlcnNhdGlvbnMsIE1lc3NhZ2VzLCBldGMuLi4pXG4gICAgdGhpcy5fY2xlYW51cCgpO1xuXG4gICAgdGhpcy5fZGVzdHJveUNvbXBvbmVudHMoKTtcblxuICAgIENsaWVudFJlZ2lzdHJ5LnVucmVnaXN0ZXIodGhpcyk7XG5cbiAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgdGhpcy5faW5DbGVhbnVwID0gZmFsc2U7XG4gIH1cblxuICBfX2FkanVzdEFwcElkKCkge1xuICAgIGlmICh0aGlzLmFwcElkKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmFwcElkSW1tdXRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhIGNvbnZlcnNhdGlvbiBieSBJZGVudGlmaWVyLlxuICAgKlxuICAgKiAgICAgIHZhciBjID0gY2xpZW50LmdldENvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJyk7XG4gICAqXG4gICAqIElmIHRoZXJlIGlzIG5vdCBhIGNvbnZlcnNhdGlvbiB3aXRoIHRoYXQgaWQsIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAqXG4gICAqIElmIHlvdSB3YW50IGl0IHRvIGxvYWQgaXQgZnJvbSBjYWNoZSBhbmQgdGhlbiBmcm9tIHNlcnZlciBpZiBub3QgaW4gY2FjaGUsIHVzZSB0aGUgYGNhbkxvYWRgIHBhcmFtZXRlci5cbiAgICogSWYgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIsIHRoZSBtZXRob2Qgd2lsbCByZXR1cm5cbiAgICogYSBsYXllci5Db252ZXJzYXRpb24gaW5zdGFuY2UgdGhhdCBoYXMgbm8gZGF0YTsgdGhlIGBjb252ZXJzYXRpb25zOmxvYWRlZGAgLyBgY29udmVyc2F0aW9uczpsb2FkZWQtZXJyb3JgIGV2ZW50c1xuICAgKiB3aWxsIGxldCB5b3Uga25vdyB3aGVuIHRoZSBjb252ZXJzYXRpb24gaGFzIGZpbmlzaGVkL2ZhaWxlZCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvMTIzJywgdHJ1ZSlcbiAgICogICAgICAub24oJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIC8vIFJlbmRlciB0aGUgQ29udmVyc2F0aW9uIHdpdGggYWxsIG9mIGl0cyBkZXRhaWxzIGxvYWRlZFxuICAgKiAgICAgICAgICBteXJlcmVuZGVyKGMpO1xuICAgKiAgICAgIH0pO1xuICAgKiAgICAgIC8vIFJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBjIHVudGlsIHRoZSBkZXRhaWxzIG9mIGMgaGF2ZSBsb2FkZWRcbiAgICogICAgICBteXJlbmRlcihjKTtcbiAgICpcbiAgICogTm90ZSBpbiB0aGUgYWJvdmUgZXhhbXBsZSB0aGF0IHRoZSBgY29udmVyc2F0aW9uczpsb2FkZWRgIGV2ZW50IHdpbGwgdHJpZ2dlciBldmVuIGlmIHRoZSBDb252ZXJzYXRpb24gaGFzIHByZXZpb3VzbHkgbG9hZGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgY29udmVyc2F0aW9uIGZyb21cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgc2VydmVyIGlmIG5vdCBmb3VuZFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBnZXRDb252ZXJzYXRpb24oaWQsIGNhbkxvYWQpIHtcbiAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuICAgIGlmICh0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtpZF0pIHtcbiAgICAgIHJldHVybiB0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtpZF07XG4gICAgfSBlbHNlIGlmIChjYW5Mb2FkKSB7XG4gICAgICByZXR1cm4gQ29udmVyc2F0aW9uLmxvYWQoaWQsIHRoaXMpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgY29udmVyc2F0aW9uIHRvIHRoZSBjbGllbnQuXG4gICAqXG4gICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAqIGF1dG9tYXRpY2FsbHkgY2FsbHMgX2FkZENvbnZlcnNhdGlvbiBmb3IgeW91OlxuICAgKlxuICAgKiAgICAgIHZhciBjb252ID0gbmV3IGxheWVyLkNvbnZlcnNhdGlvbih7XG4gICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgKiAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ11cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogICAgICAvLyBPUjpcbiAgICogICAgICB2YXIgY29udiA9IGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oWydhJywgJ2InXSk7XG4gICAqXG4gICAqIEBtZXRob2QgX2FkZENvbnZlcnNhdGlvblxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge2xheWVyLkNvbnZlcnNhdGlvbn0gY1xuICAgKi9cbiAgX2FkZENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICBjb25zdCBpZCA9IGNvbnZlcnNhdGlvbi5pZDtcbiAgICBpZiAoIXRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW2lkXSkge1xuICAgICAgLy8gUmVnaXN0ZXIgdGhlIENvbnZlcnNhdGlvblxuICAgICAgdGhpcy5fY29udmVyc2F0aW9uc0hhc2hbaWRdID0gY29udmVyc2F0aW9uO1xuXG4gICAgICAvLyBNYWtlIHN1cmUgdGhlIGNsaWVudCBpcyBzZXQgc28gdGhhdCB0aGUgbmV4dCBldmVudCBidWJibGVzIHVwXG4gICAgICBpZiAoY29udmVyc2F0aW9uLmNsaWVudElkICE9PSB0aGlzLmFwcElkKSBjb252ZXJzYXRpb24uY2xpZW50SWQgPSB0aGlzLmFwcElkO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmFkZCcsIHsgY29udmVyc2F0aW9uczogW2NvbnZlcnNhdGlvbl0gfSk7XG5cbiAgICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlKGNvbnZlcnNhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBjb252ZXJzYXRpb24gZnJvbSB0aGUgY2xpZW50LlxuICAgKlxuICAgKiBUeXBpY2FsbHksIHlvdSBkbyBub3QgbmVlZCB0byBjYWxsIHRoaXM7IHRoZSBmb2xsb3dpbmcgY29kZVxuICAgKiBhdXRvbWF0aWNhbGx5IGNhbGxzIF9yZW1vdmVDb252ZXJzYXRpb24gZm9yIHlvdTpcbiAgICpcbiAgICogICAgICBjb252ZXJhdGlvbi5kZXN0cm95KCk7XG4gICAqXG4gICAqIEBtZXRob2QgX3JlbW92ZUNvbnZlcnNhdGlvblxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge2xheWVyLkNvbnZlcnNhdGlvbn0gY1xuICAgKi9cbiAgX3JlbW92ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAvLyBJbnN1cmUgd2UgZG8gbm90IGdldCBhbnkgZXZlbnRzLCBzdWNoIGFzIG1lc3NhZ2U6cmVtb3ZlXG4gICAgY29udmVyc2F0aW9uLm9mZihudWxsLCBudWxsLCB0aGlzKTtcblxuICAgIGlmICh0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtjb252ZXJzYXRpb24uaWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fY29udmVyc2F0aW9uc0hhc2hbY29udmVyc2F0aW9uLmlkXTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpyZW1vdmUnLCB7IGNvbnZlcnNhdGlvbnM6IFtjb252ZXJzYXRpb25dIH0pO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBhbnkgTWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBDb252ZXJzYXRpb25cbiAgICBPYmplY3Qua2V5cyh0aGlzLl9tZXNzYWdlc0hhc2gpLmZvckVhY2goaWQgPT4ge1xuICAgICAgaWYgKHRoaXMuX21lc3NhZ2VzSGFzaFtpZF0uY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbi5pZCkge1xuICAgICAgICB0aGlzLl9tZXNzYWdlc0hhc2hbaWRdLmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgQ29udmVyc2F0aW9uIElEIGNoYW5nZXMsIHdlIG5lZWQgdG8gcmVyZWdpc3RlciB0aGUgQ29udmVyc2F0aW9uXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZUNvbnZlcnNhdGlvbklkXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjb252ZXJzYXRpb24gLSBDb252ZXJzYXRpb24gd2hvc2UgSUQgaGFzIGNoYW5nZWRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBvbGRJZCAtIFByZXZpb3VzIElEXG4gICAqL1xuICBfdXBkYXRlQ29udmVyc2F0aW9uSWQoY29udmVyc2F0aW9uLCBvbGRJZCkge1xuICAgIGlmICh0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtvbGRJZF0pIHtcbiAgICAgIHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW2NvbnZlcnNhdGlvbi5pZF0gPSBjb252ZXJzYXRpb247XG4gICAgICBkZWxldGUgdGhpcy5fY29udmVyc2F0aW9uc0hhc2hbb2xkSWRdO1xuXG4gICAgICAvLyBUaGlzIGlzIGEgbmFzdHkgd2F5IHRvIHdvcmsuLi4gYnV0IG5lZWQgdG8gZmluZCBhbmQgdXBkYXRlIGFsbFxuICAgICAgLy8gY29udmVyc2F0aW9uSWQgcHJvcGVydGllcyBvZiBhbGwgTWVzc2FnZXMgb3IgdGhlIFF1ZXJ5J3Mgd29uJ3RcbiAgICAgIC8vIHNlZSB0aGVzZSBhcyBtYXRjaGluZyB0aGUgcXVlcnkuXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tZXNzYWdlc0hhc2gpXG4gICAgICAgICAgICAuZmlsdGVyKGlkID0+IHRoaXMuX21lc3NhZ2VzSGFzaFtpZF0uY29udmVyc2F0aW9uSWQgPT09IG9sZElkKVxuICAgICAgICAgICAgLmZvckVhY2goaWQgPT4gKHRoaXMuX21lc3NhZ2VzSGFzaFtpZF0uY29udmVyc2F0aW9uSWQgPSBjb252ZXJzYXRpb24uaWQpKTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgbWVzc2FnZSBvciBhbm5vdW5jZW1lbnQgaWQuXG4gICAqXG4gICAqIFVzZWZ1bCBmb3IgZmluZGluZyBhIG1lc3NhZ2Ugd2hlbiB5b3UgaGF2ZSBvbmx5IHRoZSBJRC5cbiAgICpcbiAgICogSWYgdGhlIG1lc3NhZ2UgaXMgbm90IGZvdW5kLCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgKlxuICAgKiBJZiB5b3Ugd2FudCBpdCB0byBsb2FkIGl0IGZyb20gY2FjaGUgYW5kIHRoZW4gZnJvbSBzZXJ2ZXIgaWYgbm90IGluIGNhY2hlLCB1c2UgdGhlIGBjYW5Mb2FkYCBwYXJhbWV0ZXIuXG4gICAqIElmIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLCB0aGUgbWV0aG9kIHdpbGwgcmV0dXJuXG4gICAqIGEgbGF5ZXIuTWVzc2FnZSBpbnN0YW5jZSB0aGF0IGhhcyBubyBkYXRhOyB0aGUgbWVzc2FnZXM6bG9hZGVkL21lc3NhZ2VzOmxvYWRlZC1lcnJvciBldmVudHNcbiAgICogd2lsbCBsZXQgeW91IGtub3cgd2hlbiB0aGUgbWVzc2FnZSBoYXMgZmluaXNoZWQvZmFpbGVkIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIHZhciBtID0gY2xpZW50LmdldE1lc3NhZ2UoJ2xheWVyOi8vL21lc3NhZ2VzLzEyMycsIHRydWUpXG4gICAqICAgICAgLm9uKCdtZXNzYWdlczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgLy8gUmVuZGVyIHRoZSBNZXNzYWdlIHdpdGggYWxsIG9mIGl0cyBkZXRhaWxzIGxvYWRlZFxuICAgKiAgICAgICAgICBteXJlcmVuZGVyKG0pO1xuICAgKiAgICAgIH0pO1xuICAgKiAgICAgIC8vIFJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBtIHVudGlsIHRoZSBkZXRhaWxzIG9mIG0gaGF2ZSBsb2FkZWRcbiAgICogICAgICBteXJlbmRlcihtKTtcbiAgICpcbiAgICpcbiAgICogQG1ldGhvZCBnZXRNZXNzYWdlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWQgICAgICAgICAgICAgIC0gbGF5ZXI6Ly8vbWVzc2FnZXMvdXVpZFxuICAgKiBAcGFyYW0gIHtib29sZWFufSBbY2FuTG9hZD1mYWxzZV0gLSBQYXNzIHRydWUgdG8gYWxsb3cgbG9hZGluZyBhIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyIGlmIG5vdCBmb3VuZFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgZ2V0TWVzc2FnZShpZCwgY2FuTG9hZCkge1xuICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmlkUGFyYW1SZXF1aXJlZCk7XG5cbiAgICBpZiAodGhpcy5fbWVzc2FnZXNIYXNoW2lkXSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21lc3NhZ2VzSGFzaFtpZF07XG4gICAgfSBlbHNlIGlmIChjYW5Mb2FkKSB7XG4gICAgICByZXR1cm4gU3luY2FibGUubG9hZChpZCwgdGhpcyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIE1lc3NhZ2VQYXJ0IGJ5IElEXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgcGFydCA9IGNsaWVudC5nZXRNZXNzYWdlUGFydCgnbGF5ZXI6Ly8vbWVzc2FnZXMvNmYwOGFjZmEtMzI2OC00YWU1LTgzZDktNmNhMDAwMDAwMDAvcGFydHMvMCcpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBnZXRNZXNzYWdlUGFydFxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgLSBJRCBvZiB0aGUgTWVzc2FnZSBQYXJ0OyBsYXllcjovLy9tZXNzYWdlcy91dWlkL3BhcnRzLzVcbiAgICovXG4gIGdldE1lc3NhZ2VQYXJ0KGlkKSB7XG4gICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuaWRQYXJhbVJlcXVpcmVkKTtcblxuICAgIGNvbnN0IG1lc3NhZ2VJZCA9IGlkLnJlcGxhY2UoL1xcL3BhcnRzLiokLywgJycpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmdldE1lc3NhZ2UobWVzc2FnZUlkKTtcbiAgICBpZiAobWVzc2FnZSkgcmV0dXJuIG1lc3NhZ2UuZ2V0UGFydEJ5SWQoaWQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIG1lc3NhZ2UgaW4gX21lc3NhZ2VzSGFzaCBhbmQgdHJpZ2dlcnMgZXZlbnRzLlxuICAgKlxuICAgKiBNYXkgYWxzbyB1cGRhdGUgQ29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9hZGRNZXNzYWdlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZX0gbWVzc2FnZVxuICAgKi9cbiAgX2FkZE1lc3NhZ2UobWVzc2FnZSkge1xuICAgIGlmICghdGhpcy5fbWVzc2FnZXNIYXNoW21lc3NhZ2UuaWRdKSB7XG4gICAgICB0aGlzLl9tZXNzYWdlc0hhc2hbbWVzc2FnZS5pZF0gPSBtZXNzYWdlO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczphZGQnLCB7IG1lc3NhZ2VzOiBbbWVzc2FnZV0gfSk7XG4gICAgICBpZiAobWVzc2FnZS5fbm90aWZ5KSB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6bm90aWZ5JywgeyBtZXNzYWdlIH0pO1xuICAgICAgICBtZXNzYWdlLl9ub3RpZnkgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gbWVzc2FnZS5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgICAgaWYgKGNvbnZlcnNhdGlvbiAmJiAoIWNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSB8fCBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UucG9zaXRpb24gPCBtZXNzYWdlLnBvc2l0aW9uKSkge1xuICAgICAgICBjb25zdCBsYXN0TWVzc2FnZVdhcyA9IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZTtcbiAgICAgICAgY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgaWYgKGxhc3RNZXNzYWdlV2FzKSB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShsYXN0TWVzc2FnZVdhcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShtZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBtZXNzYWdlIGZyb20gX21lc3NhZ2VzSGFzaC5cbiAgICpcbiAgICogQWNjZXB0cyBJRHMgb3IgTWVzc2FnZSBpbnN0YW5jZXNcbiAgICpcbiAgICogVE9ETzogUmVtb3ZlIHN1cHBvcnQgZm9yIHJlbW92ZSBieSBJRFxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2V8c3RyaW5nfSBtZXNzYWdlIG9yIE1lc3NhZ2UgSURcbiAgICovXG4gIF9yZW1vdmVNZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICBjb25zdCBpZCA9ICh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycpID8gbWVzc2FnZSA6IG1lc3NhZ2UuaWQ7XG4gICAgbWVzc2FnZSA9IHRoaXMuX21lc3NhZ2VzSGFzaFtpZF07XG4gICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9tZXNzYWdlc0hhc2hbaWRdO1xuICAgICAgaWYgKCF0aGlzLl9pbkNsZWFudXApIHtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpyZW1vdmUnLCB7IG1lc3NhZ2VzOiBbbWVzc2FnZV0gfSk7XG4gICAgICAgIGNvbnN0IGNvbnYgPSBtZXNzYWdlLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICAgIGlmIChjb252ICYmIGNvbnYubGFzdE1lc3NhZ2UgPT09IG1lc3NhZ2UpIGNvbnYubGFzdE1lc3NhZ2UgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGRlbGV0ZSBmcm9tIHBvc2l0aW9uIGV2ZW50IGZyb20gV2Vic29ja2V0LlxuICAgKlxuICAgKiBBIFdlYlNvY2tldCBtYXkgZGVsaXZlciBhIGBkZWxldGVgIENvbnZlcnNhdGlvbiBldmVudCB3aXRoIGFcbiAgICogZnJvbV9wb3NpdGlvbiBmaWVsZCBpbmRpY2F0aW5nIHRoYXQgYWxsIE1lc3NhZ2VzIGF0IHRoZSBzcGVjaWZpZWQgcG9zaXRpb25cbiAgICogYW5kIGVhcmxpZXIgc2hvdWxkIGJlIGRlbGV0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX3B1cmdlTWVzc2FnZXNCeVBvc2l0aW9uXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBjb252ZXJzYXRpb25JZFxuICAgKiBAcGFyYW0ge251bWJlcn0gZnJvbVBvc2l0aW9uXG4gICAqL1xuICBfcHVyZ2VNZXNzYWdlc0J5UG9zaXRpb24oY29udmVyc2F0aW9uSWQsIGZyb21Qb3NpdGlvbikge1xuICAgIE9iamVjdC5rZXlzKHRoaXMuX21lc3NhZ2VzSGFzaCkuZm9yRWFjaChtSWQgPT4ge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX21lc3NhZ2VzSGFzaFttSWRdO1xuICAgICAgaWYgKG1lc3NhZ2UuY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbklkICYmIG1lc3NhZ2UucG9zaXRpb24gPD0gZnJvbVBvc2l0aW9uKSB7XG4gICAgICAgIG1lc3NhZ2UuZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGEgaWRlbnRpdHkgYnkgSWRlbnRpZmllci5cbiAgICpcbiAgICogICAgICB2YXIgaWRlbnRpdHkgPSBjbGllbnQuZ2V0SWRlbnRpdHkoJ2xheWVyOi8vL2lkZW50aXRpZXMvdXNlcl9pZCcpO1xuICAgKlxuICAgKiBJZiB0aGVyZSBpcyBub3QgYW4gSWRlbnRpdHkgd2l0aCB0aGF0IGlkLCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgKlxuICAgKiBJZiB5b3Ugd2FudCBpdCB0byBsb2FkIGl0IGZyb20gY2FjaGUgYW5kIHRoZW4gZnJvbSBzZXJ2ZXIgaWYgbm90IGluIGNhY2hlLCB1c2UgdGhlIGBjYW5Mb2FkYCBwYXJhbWV0ZXIuXG4gICAqIFRoaXMgaXMgb25seSBzdXBwb3J0ZWQgZm9yIFVzZXIgSWRlbnRpdGllcywgbm90IFNlcnZpY2UgSWRlbnRpdGllcy5cbiAgICpcbiAgICogSWYgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIsIHRoZSBtZXRob2Qgd2lsbCByZXR1cm5cbiAgICogYSBsYXllci5JZGVudGl0eSBpbnN0YW5jZSB0aGF0IGhhcyBubyBkYXRhOyB0aGUgaWRlbnRpdGllczpsb2FkZWQvaWRlbnRpdGllczpsb2FkZWQtZXJyb3IgZXZlbnRzXG4gICAqIHdpbGwgbGV0IHlvdSBrbm93IHdoZW4gdGhlIGlkZW50aXR5IGhhcyBmaW5pc2hlZC9mYWlsZWQgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgdmFyIHVzZXIgPSBjbGllbnQuZ2V0SWRlbnRpdHkoJ2xheWVyOi8vL2lkZW50aXRpZXMvMTIzJywgdHJ1ZSlcbiAgICogICAgICAub24oJ2lkZW50aXRpZXM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIC8vIFJlbmRlciB0aGUgdXNlciBsaXN0IHdpdGggYWxsIG9mIGl0cyBkZXRhaWxzIGxvYWRlZFxuICAgKiAgICAgICAgICBteXJlcmVuZGVyKHVzZXIpO1xuICAgKiAgICAgIH0pO1xuICAgKiAgICAgIC8vIFJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciB1c2VyIHVudGlsIHRoZSBkZXRhaWxzIG9mIHVzZXIgaGF2ZSBsb2FkZWRcbiAgICogICAgICBteXJlbmRlcih1c2VyKTtcbiAgICpcbiAgICogQG1ldGhvZCBnZXRJZGVudGl0eVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gQWNjZXB0cyBmdWxsIExheWVyIElEIChsYXllcjovLy9pZGVudGl0aWVzL2Zyb2RvLXRoZS1kb2RvKSBvciBqdXN0IHRoZSBVc2VySUQgKGZyb2RvLXRoZS1kb2RvKS5cbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gW2NhbkxvYWQ9ZmFsc2VdIC0gUGFzcyB0cnVlIHRvIGFsbG93IGxvYWRpbmcgYW4gaWRlbnRpdHkgZnJvbVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAqIEByZXR1cm4ge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgZ2V0SWRlbnRpdHkoaWQsIGNhbkxvYWQpIHtcbiAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuICAgIGlmICghSWRlbnRpdHkuaXNWYWxpZElkKGlkKSkge1xuICAgICAgaWQgPSBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KGlkKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5faWRlbnRpdGllc0hhc2hbaWRdKSB7XG4gICAgICByZXR1cm4gdGhpcy5faWRlbnRpdGllc0hhc2hbaWRdO1xuICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgcmV0dXJuIElkZW50aXR5LmxvYWQoaWQsIHRoaXMpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUYWtlcyBhbiBhcnJheSBvZiBJZGVudGl0eSBpbnN0YW5jZXMsIFVzZXIgSURzLCBJZGVudGl0eSBJRHMsIElkZW50aXR5IG9iamVjdHMsXG4gICAqIG9yIFNlcnZlciBmb3JtYXR0ZWQgSWRlbnRpdHkgT2JqZWN0cyBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiBJZGVudGl0eSBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpeElkZW50aXRpZXNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtNaXhlZFtdfSBpZGVudGl0aWVzIC0gU29tZXRoaW5nIHRoYXQgdGVsbHMgdXMgd2hhdCBJZGVudGl0eSB0byByZXR1cm5cbiAgICogQHJldHVybiB7bGF5ZXIuSWRlbnRpdHlbXX1cbiAgICovXG4gIF9maXhJZGVudGl0aWVzKGlkZW50aXRpZXMpIHtcbiAgICByZXR1cm4gaWRlbnRpdGllcy5tYXAoKGlkZW50aXR5KSA9PiB7XG4gICAgICBpZiAoaWRlbnRpdHkgaW5zdGFuY2VvZiBJZGVudGl0eSkgcmV0dXJuIGlkZW50aXR5O1xuICAgICAgaWYgKHR5cGVvZiBpZGVudGl0eSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SWRlbnRpdHkoaWRlbnRpdHksIHRydWUpO1xuICAgICAgfSBlbHNlIGlmIChpZGVudGl0eSAmJiB0eXBlb2YgaWRlbnRpdHkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICgndXNlcklkJyBpbiBpZGVudGl0eSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldElkZW50aXR5KGlkZW50aXR5LmlkIHx8IGlkZW50aXR5LnVzZXJJZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoJ3VzZXJfaWQnIGluIGlkZW50aXR5KSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX2NyZWF0ZU9iamVjdChpZGVudGl0eSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIGlkZW50aXR5IHRvIHRoZSBjbGllbnQuXG4gICAqXG4gICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIElkZW50aXR5IGNvbnN0cnVjdG9yIHdpbGwgY2FsbCB0aGlzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9hZGRJZGVudGl0eVxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5fSBpZGVudGl0eVxuICAgKlxuICAgKiBUT0RPOiBJdCBzaG91bGQgYmUgcG9zc2libGUgdG8gYWRkIGFuIElkZW50aXR5IHdob3NlIHVzZXJJZCBpcyBwb3B1bGF0ZWQsIGJ1dFxuICAgKiBvdGhlciB2YWx1ZXMgYXJlIG5vdCB5ZXQgbG9hZGVkIGZyb20gdGhlIHNlcnZlci4gIFNob3VsZCBhZGQgdG8gX2lkZW50aXRpZXNIYXNoIG5vd1xuICAgKiBidXQgdHJpZ2dlciBgaWRlbnRpdGllczphZGRgIG9ubHkgd2hlbiBpdHMgZ290IGVub3VnaCBkYXRhIHRvIGJlIHJlbmRlcmFibGUuXG4gICAqL1xuICBfYWRkSWRlbnRpdHkoaWRlbnRpdHkpIHtcbiAgICBjb25zdCBpZCA9IGlkZW50aXR5LmlkO1xuICAgIGlmIChpZCAmJiAhdGhpcy5faWRlbnRpdGllc0hhc2hbaWRdKSB7XG4gICAgICAvLyBSZWdpc3RlciB0aGUgSWRlbnRpdHlcbiAgICAgIHRoaXMuX2lkZW50aXRpZXNIYXNoW2lkXSA9IGlkZW50aXR5O1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdpZGVudGl0aWVzOmFkZCcsIHsgaWRlbnRpdGllczogW2lkZW50aXR5XSB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhbiBpZGVudGl0eSBmcm9tIHRoZSBjbGllbnQuXG4gICAqXG4gICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAqIGF1dG9tYXRpY2FsbHkgY2FsbHMgX3JlbW92ZUlkZW50aXR5IGZvciB5b3U6XG4gICAqXG4gICAqICAgICAgaWRlbnRpdHkuZGVzdHJveSgpO1xuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVJZGVudGl0eVxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5fSBpZGVudGl0eVxuICAgKi9cbiAgX3JlbW92ZUlkZW50aXR5KGlkZW50aXR5KSB7XG4gICAgLy8gSW5zdXJlIHdlIGRvIG5vdCBnZXQgYW55IGV2ZW50cywgc3VjaCBhcyBtZXNzYWdlOnJlbW92ZVxuICAgIGlkZW50aXR5Lm9mZihudWxsLCBudWxsLCB0aGlzKTtcblxuICAgIGNvbnN0IGlkID0gaWRlbnRpdHkuaWQ7XG4gICAgaWYgKHRoaXMuX2lkZW50aXRpZXNIYXNoW2lkXSkge1xuICAgICAgZGVsZXRlIHRoaXMuX2lkZW50aXRpZXNIYXNoW2lkXTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnaWRlbnRpdGllczpyZW1vdmUnLCB7IGlkZW50aXRpZXM6IFtpZGVudGl0eV0gfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZvbGxvdyB0aGlzIHVzZXIgYW5kIGdldCBGdWxsIElkZW50aXR5LCBhbmQgd2Vic29ja2V0IGNoYW5nZXMgb24gSWRlbnRpdHkuXG4gICAqXG4gICAqIEBtZXRob2QgZm9sbG93SWRlbnRpdHlcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIEFjY2VwdHMgZnVsbCBMYXllciBJRCAobGF5ZXI6Ly8vaWRlbnRpdGllcy9mcm9kby10aGUtZG9kbykgb3IganVzdCB0aGUgVXNlcklEIChmcm9kby10aGUtZG9kbykuXG4gICAqIEByZXR1cm5zIHtsYXllci5JZGVudGl0eX1cbiAgICovXG4gIGZvbGxvd0lkZW50aXR5KGlkKSB7XG4gICAgaWYgKCFJZGVudGl0eS5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICBpZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQoaWQpO1xuICAgIH1cbiAgICBsZXQgaWRlbnRpdHkgPSB0aGlzLmdldElkZW50aXR5KGlkKTtcbiAgICBpZiAoIWlkZW50aXR5KSB7XG4gICAgICBpZGVudGl0eSA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgIGlkLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgdXNlcklkOiBpZC5zdWJzdHJpbmcoMjApLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlkZW50aXR5LmZvbGxvdygpO1xuICAgIHJldHVybiBpZGVudGl0eTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVbmZvbGxvdyB0aGlzIHVzZXIgYW5kIGdldCBvbmx5IEJhc2ljIElkZW50aXR5LCBhbmQgbm8gd2Vic29ja2V0IGNoYW5nZXMgb24gSWRlbnRpdHkuXG4gICAqXG4gICAqIEBtZXRob2QgdW5mb2xsb3dJZGVudGl0eVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gQWNjZXB0cyBmdWxsIExheWVyIElEIChsYXllcjovLy9pZGVudGl0aWVzL2Zyb2RvLXRoZS1kb2RvKSBvciBqdXN0IHRoZSBVc2VySUQgKGZyb2RvLXRoZS1kb2RvKS5cbiAgICogQHJldHVybnMge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgdW5mb2xsb3dJZGVudGl0eShpZCkge1xuICAgIGlmICghSWRlbnRpdHkuaXNWYWxpZElkKGlkKSkge1xuICAgICAgaWQgPSBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KGlkKTtcbiAgICB9XG4gICAgbGV0IGlkZW50aXR5ID0gdGhpcy5nZXRJZGVudGl0eShpZCk7XG4gICAgaWYgKCFpZGVudGl0eSkge1xuICAgICAgaWRlbnRpdHkgPSBuZXcgSWRlbnRpdHkoe1xuICAgICAgICBpZCxcbiAgICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgIHVzZXJJZDogaWQuc3Vic3RyaW5nKDIwKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZGVudGl0eS51bmZvbGxvdygpO1xuICAgIHJldHVybiBpZGVudGl0eTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUYWtlcyBhcyBpbnB1dCBhbiBvYmplY3QgaWQsIGFuZCBlaXRoZXIgY2FsbHMgZ2V0Q29udmVyc2F0aW9uKCkgb3IgZ2V0TWVzc2FnZSgpIGFzIG5lZWRlZC5cbiAgICpcbiAgICogV2lsbCBvbmx5IGdldCBjYWNoZWQgb2JqZWN0cywgd2lsbCBub3QgZ2V0IG9iamVjdHMgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBUaGlzIGlzIG5vdCBhIHB1YmxpYyBtZXRob2QgbW9zdGx5IHNvIHRoZXJlJ3Mgbm8gYW1iaWd1aXR5IG92ZXIgdXNpbmcgZ2V0WFhYXG4gICAqIG9yIF9nZXRPYmplY3QuICBnZXRYWFggdHlwaWNhbGx5IGhhcyBhbiBvcHRpb24gdG8gbG9hZCB0aGUgcmVzb3VyY2UsIHdoaWNoIHRoaXNcbiAgICogZG9lcyBub3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldE9iamVjdFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWQgLSBNZXNzYWdlLCBDb252ZXJzYXRpb24gb3IgUXVlcnkgaWRcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZXxsYXllci5Db252ZXJzYXRpb258bGF5ZXIuUXVlcnl9XG4gICAqL1xuICBfZ2V0T2JqZWN0KGlkKSB7XG4gICAgc3dpdGNoIChVdGlsLnR5cGVGcm9tSUQoaWQpKSB7XG4gICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICBjYXNlICdhbm5vdW5jZW1lbnRzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0TWVzc2FnZShpZCk7XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udmVyc2F0aW9uKGlkKTtcbiAgICAgIGNhc2UgJ3F1ZXJpZXMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWVyeShpZCk7XG4gICAgICBjYXNlICdpZGVudGl0aWVzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SWRlbnRpdHkoaWQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFRha2VzIGFuIG9iamVjdCBkZXNjcmlwdGlvbiBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGVpdGhlciB1cGRhdGVzIGl0IChpZiBjYWNoZWQpXG4gICAqIG9yIGNyZWF0ZXMgYW5kIGNhY2hlcyBpdCAuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZU9iamVjdFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb2JqIC0gUGxhaW4gamF2YXNjcmlwdCBvYmplY3QgcmVwcmVzZW50aW5nIGEgTWVzc2FnZSBvciBDb252ZXJzYXRpb25cbiAgICovXG4gIF9jcmVhdGVPYmplY3Qob2JqKSB7XG4gICAgY29uc3QgaXRlbSA9IHRoaXMuX2dldE9iamVjdChvYmouaWQpO1xuICAgIGlmIChpdGVtKSB7XG4gICAgICBpdGVtLl9wb3B1bGF0ZUZyb21TZXJ2ZXIob2JqKTtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH0gZWxzZSB7XG4gICAgICBzd2l0Y2ggKFV0aWwudHlwZUZyb21JRChvYmouaWQpKSB7XG4gICAgICAgIGNhc2UgJ21lc3NhZ2VzJzpcbiAgICAgICAgICByZXR1cm4gTWVzc2FnZS5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICBjYXNlICdhbm5vdW5jZW1lbnRzJzpcbiAgICAgICAgICByZXR1cm4gQW5ub3VuY2VtZW50Ll9jcmVhdGVGcm9tU2VydmVyKG9iaiwgdGhpcyk7XG4gICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICAgIHJldHVybiBDb252ZXJzYXRpb24uX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgICAgY2FzZSAnaWRlbnRpdGllcyc6XG4gICAgICAgICAgcmV0dXJuIElkZW50aXR5Ll9jcmVhdGVGcm9tU2VydmVyKG9iaiwgdGhpcyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlIGV2ZW50cyBpbnRvIHNtYWxsZXIgbnVtYmVycyBvZiBtb3JlIGNvbXBsZXRlIGV2ZW50cy5cbiAgICpcbiAgICogQmVmb3JlIGFueSBkZWxheWVkIHRyaWdnZXJzIGFyZSBmaXJlZCwgZm9sZCB0b2dldGhlciBhbGwgb2YgdGhlIGNvbnZlcnNhdGlvbnM6YWRkXG4gICAqIGFuZCBjb252ZXJzYXRpb25zOnJlbW92ZSBldmVudHMgc28gdGhhdCAxMDAgY29udmVyc2F0aW9uczphZGQgZXZlbnRzIGNhbiBiZSBmaXJlZCBhc1xuICAgKiBhIHNpbmdsZSBldmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc0RlbGF5ZWRUcmlnZ2Vyc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcblxuICAgIGNvbnN0IGFkZENvbnZlcnNhdGlvbnMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKChldnQpID0+IGV2dFswXSA9PT0gJ2NvbnZlcnNhdGlvbnM6YWRkJyk7XG4gICAgY29uc3QgcmVtb3ZlQ29udmVyc2F0aW9ucyA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5maWx0ZXIoKGV2dCkgPT4gZXZ0WzBdID09PSAnY29udmVyc2F0aW9uczpyZW1vdmUnKTtcbiAgICB0aGlzLl9mb2xkRXZlbnRzKGFkZENvbnZlcnNhdGlvbnMsICdjb252ZXJzYXRpb25zJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVDb252ZXJzYXRpb25zLCAnY29udmVyc2F0aW9ucycsIHRoaXMpO1xuXG4gICAgY29uc3QgYWRkTWVzc2FnZXMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKChldnQpID0+IGV2dFswXSA9PT0gJ21lc3NhZ2VzOmFkZCcpO1xuICAgIGNvbnN0IHJlbW92ZU1lc3NhZ2VzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcigoZXZ0KSA9PiBldnRbMF0gPT09ICdtZXNzYWdlczpyZW1vdmUnKTtcblxuICAgIHRoaXMuX2ZvbGRFdmVudHMoYWRkTWVzc2FnZXMsICdtZXNzYWdlcycsIHRoaXMpO1xuICAgIHRoaXMuX2ZvbGRFdmVudHMocmVtb3ZlTWVzc2FnZXMsICdtZXNzYWdlcycsIHRoaXMpO1xuXG4gICAgY29uc3QgYWRkSWRlbnRpdGllcyA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5maWx0ZXIoKGV2dCkgPT4gZXZ0WzBdID09PSAnaWRlbnRpdGllczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVJZGVudGl0aWVzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcigoZXZ0KSA9PiBldnRbMF0gPT09ICdpZGVudGl0aWVzOnJlbW92ZScpO1xuXG4gICAgdGhpcy5fZm9sZEV2ZW50cyhhZGRJZGVudGl0aWVzLCAnaWRlbnRpdGllcycsIHRoaXMpO1xuICAgIHRoaXMuX2ZvbGRFdmVudHMocmVtb3ZlSWRlbnRpdGllcywgJ2lkZW50aXRpZXMnLCB0aGlzKTtcblxuICAgIHN1cGVyLl9wcm9jZXNzRGVsYXllZFRyaWdnZXJzKCk7XG4gIH1cblxuICB0cmlnZ2VyKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgdGhpcy5fdHJpZ2dlckxvZ2dlcihldmVudE5hbWUsIGV2dCk7XG4gICAgc3VwZXIudHJpZ2dlcihldmVudE5hbWUsIGV2dCk7XG4gIH1cblxuICAvKipcbiAgICogRG9lcyBsb2dnaW5nIG9uIGFsbCB0cmlnZ2VyZWQgZXZlbnRzLlxuICAgKlxuICAgKiBBbGwgbG9nZ2luZyBpcyBkb25lIGF0IGBkZWJ1Z2Agb3IgYGluZm9gIGxldmVscy5cbiAgICpcbiAgICogQG1ldGhvZCBfdHJpZ2dlckxvZ2dlclxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3RyaWdnZXJMb2dnZXIoZXZlbnROYW1lLCBldnQpIHtcbiAgICBjb25zdCBpbmZvRXZlbnRzID0gW1xuICAgICAgJ2NvbnZlcnNhdGlvbnM6YWRkJywgJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJywgJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJyxcbiAgICAgICdtZXNzYWdlczphZGQnLCAnbWVzc2FnZXM6cmVtb3ZlJywgJ21lc3NhZ2VzOmNoYW5nZScsXG4gICAgICAnaWRlbnRpdGllczphZGQnLCAnaWRlbnRpdGllczpyZW1vdmUnLCAnaWRlbnRpdGllczpjaGFuZ2UnLFxuICAgICAgJ2NoYWxsZW5nZScsICdyZWFkeScsXG4gICAgXTtcbiAgICBpZiAoaW5mb0V2ZW50cy5pbmRleE9mKGV2ZW50TmFtZSkgIT09IC0xKSB7XG4gICAgICBpZiAoZXZ0ICYmIGV2dC5pc0NoYW5nZSkge1xuICAgICAgICBsb2dnZXIuaW5mbyhgQ2xpZW50IEV2ZW50OiAke2V2ZW50TmFtZX0gJHtldnQuY2hhbmdlcy5tYXAoY2hhbmdlID0+IGNoYW5nZS5wcm9wZXJ0eSkuam9pbignLCAnKX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCB0ZXh0ID0gJyc7XG4gICAgICAgIGlmIChldnQpIHtcbiAgICAgICAgICBpZiAoZXZ0Lm1lc3NhZ2UpIHRleHQgPSBldnQubWVzc2FnZS5pZDtcbiAgICAgICAgICBpZiAoZXZ0Lm1lc3NhZ2VzKSB0ZXh0ID0gZXZ0Lm1lc3NhZ2VzLmxlbmd0aCArICcgbWVzc2FnZXMnO1xuICAgICAgICAgIGlmIChldnQuY29udmVyc2F0aW9uKSB0ZXh0ID0gZXZ0LmNvbnZlcnNhdGlvbi5pZDtcbiAgICAgICAgICBpZiAoZXZ0LmNvbnZlcnNhdGlvbnMpIHRleHQgPSBldnQuY29udmVyc2F0aW9ucy5sZW5ndGggKyAnIGNvbnZlcnNhdGlvbnMnO1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlci5pbmZvKGBDbGllbnQgRXZlbnQ6ICR7ZXZlbnROYW1lfSAke3RleHR9YCk7XG4gICAgICB9XG4gICAgICBpZiAoZXZ0KSBsb2dnZXIuZGVidWcoZXZ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmRlYnVnKGV2ZW50TmFtZSwgZXZ0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VhcmNoZXMgbG9jYWxseSBjYWNoZWQgY29udmVyc2F0aW9ucyBmb3IgYSBtYXRjaGluZyBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEl0ZXJhdGVzIG92ZXIgY29udmVyc2F0aW9ucyBjYWxsaW5nIGEgbWF0Y2hpbmcgZnVuY3Rpb24gdW50aWxcbiAgICogdGhlIGNvbnZlcnNhdGlvbiBpcyBmb3VuZCBvciBhbGwgY29udmVyc2F0aW9ucyB0ZXN0ZWQuXG4gICAqXG4gICAqICAgICAgdmFyIGMgPSBjbGllbnQuZmluZENvbnZlcnNhdGlvbihmdW5jdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICogICAgICAgICAgaWYgKGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMuaW5kZXhPZignYScpICE9IC0xKSByZXR1cm4gdHJ1ZTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBmaW5kQ2FjaGVkQ29udmVyc2F0aW9uXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmIC0gRnVuY3Rpb24gdG8gY2FsbCB1bnRpbCB3ZSBmaW5kIGEgbWF0Y2hcbiAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBmLmNvbnZlcnNhdGlvbiAtIEEgY29udmVyc2F0aW9uIHRvIHRlc3RcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gZi5yZXR1cm4gLSBSZXR1cm4gdHJ1ZSBpZiB0aGUgY29udmVyc2F0aW9uIGlzIGEgbWF0Y2hcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgKnRoaXMqIG9iamVjdFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqIFRoaXMgc2hvdWxkIGJlIHJlcGxhY2VkIGJ5IGl0ZXJhdGluZyBvdmVyIHlvdXIgbGF5ZXIuUXVlcnkgZGF0YS5cbiAgICovXG4gIGZpbmRDYWNoZWRDb252ZXJzYXRpb24oZnVuYywgY29udGV4dCkge1xuICAgIGNvbnN0IHRlc3QgPSBjb250ZXh0ID8gZnVuYy5iaW5kKGNvbnRleHQpIDogZnVuYztcbiAgICBjb25zdCBsaXN0ID0gT2JqZWN0LmtleXModGhpcy5fY29udmVyc2F0aW9uc0hhc2gpO1xuICAgIGNvbnN0IGxlbiA9IGxpc3QubGVuZ3RoO1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBsZW47IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGxpc3RbaW5kZXhdO1xuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5fY29udmVyc2F0aW9uc0hhc2hba2V5XTtcbiAgICAgIGlmICh0ZXN0KGNvbnZlcnNhdGlvbiwgaW5kZXgpKSByZXR1cm4gY29udmVyc2F0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgc2Vzc2lvbiBoYXMgYmVlbiByZXNldCwgZHVtcCBhbGwgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVzZXRTZXNzaW9uKCkge1xuICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICB0aGlzLl9jb252ZXJzYXRpb25zSGFzaCA9IHt9O1xuICAgIHRoaXMuX21lc3NhZ2VzSGFzaCA9IHt9O1xuICAgIHRoaXMuX3F1ZXJpZXNIYXNoID0ge307XG4gICAgdGhpcy5faWRlbnRpdGllc0hhc2ggPSB7fTtcbiAgICByZXR1cm4gc3VwZXIuX3Jlc2V0U2Vzc2lvbigpO1xuICB9XG5cblxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBpcyByZWNvbW1lbmRlZCB3YXkgdG8gY3JlYXRlIGEgQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBUaGVyZSBhcmUgYSBmZXcgd2F5cyB0byBpbnZva2UgaXQ7IG5vdGUgdGhhdCB0aGUgZGVmYXVsdCBiZWhhdmlvciBpcyB0byBjcmVhdGUgYSBEaXN0aW5jdCBDb252ZXJzYXRpb25cbiAgICogdW5sZXNzIG90aGVyd2lzZSBzdGF0ZWQgdmlhIHRoZSBsYXllci5Db252ZXJzYXRpb24uZGlzdGluY3QgcHJvcGVydHkuXG4gICAqXG4gICAqICAgICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7cGFydGljaXBhbnRzOiBbJ2EnLCAnYiddfSk7XG4gICAqICAgICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7cGFydGljaXBhbnRzOiBbdXNlcklkZW50aXR5QSwgdXNlcklkZW50aXR5Ql19KTtcbiAgICpcbiAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAgICogICAgICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddLFxuICAgKiAgICAgICAgICAgICBkaXN0aW5jdDogZmFsc2VcbiAgICogICAgICAgICB9KTtcbiAgICpcbiAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAgICogICAgICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddLFxuICAgKiAgICAgICAgICAgICBtZXRhZGF0YToge1xuICAgKiAgICAgICAgICAgICAgICAgdGl0bGU6ICdJIGFtIGEgdGl0bGUnXG4gICAqICAgICAgICAgICAgIH1cbiAgICogICAgICAgICB9KTtcbiAgICpcbiAgICogSWYgeW91IHRyeSB0byBjcmVhdGUgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24gdGhhdCBhbHJlYWR5IGV4aXN0cyxcbiAgICogeW91IHdpbGwgZ2V0IGJhY2sgYW4gZXhpc3RpbmcgQ29udmVyc2F0aW9uLCBhbmQgYW55IHJlcXVlc3RlZCBtZXRhZGF0YVxuICAgKiB3aWxsIE5PVCBiZSBzZXQ7IHlvdSB3aWxsIGdldCB3aGF0ZXZlciBtZXRhZGF0YSB0aGUgbWF0Y2hpbmcgQ29udmVyc2F0aW9uXG4gICAqIGFscmVhZHkgaGFkLlxuICAgKlxuICAgKiBUaGUgZGVmYXVsdCB2YWx1ZSBmb3IgZGlzdGluY3QgaXMgYHRydWVgLlxuICAgKlxuICAgKiBXaGV0aGVyIHRoZSBDb252ZXJzYXRpb24gYWxyZWFkeSBleGlzdHMgb3Igbm90LCBhICdjb252ZXJzYXRpb25zOnNlbnQnIGV2ZW50XG4gICAqIHdpbGwgYmUgdHJpZ2dlcmVkIGFzeW5jaHJvbm91c2x5IGFuZCB0aGUgQ29udmVyc2F0aW9uIG9iamVjdCB3aWxsIGJlIHJlYWR5XG4gICAqIGF0IHRoYXQgdGltZS4gIEZ1cnRoZXIsIHRoZSBldmVudCB3aWxsIHByb3ZpZGUgZGV0YWlscyBvbiB0aGUgcmVzdWx0OlxuICAgKlxuICAgKiAgICAgICB2YXIgY29udmVyc2F0aW9uID0gY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gICAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICogICAgICAgICAgICB0aXRsZTogJ0kgYW0gYSB0aXRsZSdcbiAgICogICAgICAgICAgfVxuICAgKiAgICAgICB9KTtcbiAgICogICAgICAgY29udmVyc2F0aW9uLm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgIHN3aXRjaChldnQucmVzdWx0KSB7XG4gICAqICAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uQ1JFQVRFRDpcbiAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgY3JlYXRlZCcpO1xuICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICogICAgICAgICAgICAgICBjYXNlIENvbnZlcnNhdGlvbi5GT1VORDpcbiAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgZm91bmQnKTtcbiAgICogICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAqICAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6XG4gICAqICAgICAgICAgICAgICAgICAgIGFsZXJ0KGNvbnZlcnNhdGlvbi5pZCArICcgd2FzIGZvdW5kIGJ1dCBpdCBhbHJlYWR5IGhhcyBhIHRpdGxlIHNvIHlvdXIgcmVxdWVzdGVkIHRpdGxlIHdhcyBub3Qgc2V0Jyk7XG4gICAqICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgKiAgICAgICAgICAgIH1cbiAgICogICAgICAgfSk7XG4gICAqXG4gICAqIFdhcm5pbmc6IFRoaXMgbWV0aG9kIHdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgY2FsbGVkIHdoZW4geW91IGFyZSBub3QgKG9yIGFyZSBubyBsb25nZXIpIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICogVGhhdCBtZWFucyBpZiBhdXRoZW50aWNhdGlvbiBoYXMgZXhwaXJlZCwgYW5kIHlvdSBoYXZlIG5vdCB5ZXQgcmVhdXRoZW50aWNhdGVkIHRoZSB1c2VyLCB0aGlzIHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gICAqXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlQ29udmVyc2F0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IHBhcnRpY2lwYW50cyAtIEFycmF5IG9mIFVzZXJJRHMgb3IgVXNlcklkZW50aXRpZXNcbiAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5kaXN0aW5jdD10cnVlXSBJcyB0aGlzIGEgZGlzdGluY3QgQ29udmVyYXRpb24/XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5tZXRhZGF0YT17fV0gTWV0YWRhdGEgZm9yIHlvdXIgQ29udmVyc2F0aW9uXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICovXG4gIGNyZWF0ZUNvbnZlcnNhdGlvbihvcHRpb25zKSB7XG4gICAgLy8gSWYgd2UgYXJlbid0IGF1dGhlbnRpY2F0ZWQsIHRoZW4gd2UgZG9uJ3QgeWV0IGhhdmUgYSBVc2VySUQsIGFuZCB3b24ndCBjcmVhdGUgdGhlIGNvcnJlY3QgQ29udmVyc2F0aW9uXG4gICAgaWYgKCF0aGlzLmlzQXV0aGVudGljYXRlZCkgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5jbGllbnRNdXN0QmVSZWFkeSk7XG4gICAgaWYgKCEoJ2Rpc3RpbmN0JyBpbiBvcHRpb25zKSkgb3B0aW9ucy5kaXN0aW5jdCA9IHRydWU7XG4gICAgb3B0aW9ucy5jbGllbnQgPSB0aGlzO1xuICAgIHJldHVybiBDb252ZXJzYXRpb24uY3JlYXRlKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBxdWVyeSBieSBxdWVyeSBpZC5cbiAgICpcbiAgICogVXNlZnVsIGZvciBmaW5kaW5nIGEgUXVlcnkgd2hlbiB5b3Ugb25seSBoYXZlIHRoZSBJRFxuICAgKlxuICAgKiBAbWV0aG9kIGdldFF1ZXJ5XG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWQgICAgICAgICAgICAgIC0gbGF5ZXI6Ly8vbWVzc2FnZXMvdXVpZFxuICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeX1cbiAgICovXG4gIGdldFF1ZXJ5KGlkKSB7XG4gICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuaWRQYXJhbVJlcXVpcmVkKTtcbiAgICByZXR1cm4gdGhpcy5fcXVlcmllc0hhc2hbaWRdIHx8IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogVGhlcmUgYXJlIHR3byBvcHRpb25zIHRvIGNyZWF0ZSBhIG5ldyBsYXllci5RdWVyeSBpbnN0YW5jZS5cbiAgICpcbiAgICogVGhlIGRpcmVjdCB3YXk6XG4gICAqXG4gICAqICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICAgKiAgICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5NZXNzYWdlLFxuICAgKiAgICAgICAgIHByZWRpY2F0ZTogJ2NvbnZlcnNhdGlvbi5pZCA9ICcnICsgY29udi5pZCArICcnJyxcbiAgICogICAgICAgICBwYWdpbmF0aW9uV2luZG93OiA1MFxuICAgKiAgICAgfSk7XG4gICAqXG4gICAqIEEgQnVpbGRlciBhcHByb2FjaCB0aGF0IGFsbG93cyBmb3IgYSBzaW1wbGVyIHN5bnRheDpcbiAgICpcbiAgICogICAgIHZhciBxQnVpbGRlciA9IFF1ZXJ5QnVpbGRlclxuICAgKiAgICAgIC5tZXNzYWdlcygpXG4gICAqICAgICAgLmZvckNvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmYnKVxuICAgKiAgICAgIC5wYWdpbmF0aW9uV2luZG93KDEwMCk7XG4gICAqICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocUJ1aWxkZXIpO1xuICAgKlxuICAgKiBAbWV0aG9kIGNyZWF0ZVF1ZXJ5XG4gICAqIEBwYXJhbSAge2xheWVyLlF1ZXJ5QnVpbGRlcnxPYmplY3R9IG9wdGlvbnMgLSBFaXRoZXIgYSBsYXllci5RdWVyeUJ1aWxkZXIgaW5zdGFuY2UsIG9yIHBhcmFtZXRlcnMgZm9yIHRoZSBsYXllci5RdWVyeSBjb25zdHJ1Y3RvclxuICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeX1cbiAgICovXG4gIGNyZWF0ZVF1ZXJ5KG9wdGlvbnMpIHtcbiAgICBsZXQgcXVlcnk7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmJ1aWxkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBxdWVyeSA9IG5ldyBRdWVyeSh0aGlzLCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucy5jbGllbnQgPSB0aGlzO1xuICAgICAgcXVlcnkgPSBuZXcgUXVlcnkob3B0aW9ucyk7XG4gICAgfVxuICAgIHRoaXMuX2FkZFF1ZXJ5KHF1ZXJ5KTtcbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgdGhlIGxheWVyLlF1ZXJ5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9hZGRRdWVyeVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5RdWVyeX0gcXVlcnlcbiAgICovXG4gIF9hZGRRdWVyeShxdWVyeSkge1xuICAgIHRoaXMuX3F1ZXJpZXNIYXNoW3F1ZXJ5LmlkXSA9IHF1ZXJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIERlcmVnaXN0ZXIgdGhlIGxheWVyLlF1ZXJ5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVRdWVyeVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5RdWVyeX0gcXVlcnkgW2Rlc2NyaXB0aW9uXVxuICAgKi9cbiAgX3JlbW92ZVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgaWYgKHF1ZXJ5KSB7XG4gICAgICBkZWxldGUgdGhpcy5fcXVlcmllc0hhc2hbcXVlcnkuaWRdO1xuICAgICAgaWYgKCF0aGlzLl9pbkNsZWFudXApIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHF1ZXJ5LmRhdGFcbiAgICAgICAgICAubWFwKG9iaiA9PiB0aGlzLl9nZXRPYmplY3Qob2JqLmlkKSlcbiAgICAgICAgICAuZmlsdGVyKG9iaiA9PiBvYmopO1xuICAgICAgICB0aGlzLl9jaGVja0FuZFB1cmdlQ2FjaGUoZGF0YSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9mZihudWxsLCBudWxsLCBxdWVyeSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRvIHNlZSBpZiB0aGUgc3BlY2lmaWVkIG9iamVjdHMgY2FuIHNhZmVseSBiZSByZW1vdmVkIGZyb20gY2FjaGUuXG4gICAqXG4gICAqIFJlbW92ZXMgZnJvbSBjYWNoZSBpZiBhbiBvYmplY3QgaXMgbm90IHBhcnQgb2YgYW55IFF1ZXJ5J3MgcmVzdWx0IHNldC5cbiAgICpcbiAgICogQG1ldGhvZCBfY2hlY2tBbmRQdXJnZUNhY2hlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlJvb3RbXX0gb2JqZWN0cyAtIEFycmF5IG9mIE1lc3NhZ2VzIG9yIENvbnZlcnNhdGlvbnNcbiAgICovXG4gIF9jaGVja0FuZFB1cmdlQ2FjaGUob2JqZWN0cykge1xuICAgIG9iamVjdHMuZm9yRWFjaChvYmogPT4ge1xuICAgICAgaWYgKCFvYmouaXNEZXN0cm95ZWQgJiYgIXRoaXMuX2lzQ2FjaGVkT2JqZWN0KG9iaikpIHtcbiAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIFJvb3QgPT09IGZhbHNlKSBvYmogPSB0aGlzLl9nZXRPYmplY3Qob2JqLmlkKTtcbiAgICAgICAgaWYgKG9iaikgb2JqLmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZXMgX3J1blNjaGVkdWxlZENoZWNrQW5kUHVyZ2VDYWNoZSBpZiBuZWVkZWQsIGFuZCBhZGRzIHRoaXMgb2JqZWN0XG4gICAqIHRvIHRoZSBsaXN0IG9mIG9iamVjdHMgaXQgd2lsbCB2YWxpZGF0ZSBmb3IgdW5jYWNoaW5nLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgYW55IG9iamVjdCB0aGF0IGRvZXMgbm90IGV4aXN0IG9uIHRoZSBzZXJ2ZXIgKCFpc1NhdmVkKCkpIGlzIGFuIG9iamVjdCB0aGF0IHRoZVxuICAgKiBhcHAgY3JlYXRlZCBhbmQgY2FuIG9ubHkgYmUgcHVyZ2VkIGJ5IHRoZSBhcHAgYW5kIG5vdCBieSB0aGUgU0RLLiAgT25jZSBpdHMgYmVlblxuICAgKiBzYXZlZCwgYW5kIGNhbiBiZSByZWxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIgd2hlbiBuZWVkZWQsIGl0cyBzdWJqZWN0IHRvIHN0YW5kYXJkIGNhY2hpbmcuXG4gICAqXG4gICAqIEBtZXRob2QgX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuUm9vdH0gb2JqZWN0XG4gICAqL1xuICBfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUob2JqZWN0KSB7XG4gICAgaWYgKG9iamVjdC5pc1NhdmVkKCkpIHtcbiAgICAgIGlmICh0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUF0IDwgRGF0ZS5ub3coKSkge1xuICAgICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUF0ID0gRGF0ZS5ub3coKSArIENsaWVudC5DQUNIRV9QVVJHRV9JTlRFUlZBTDtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9ydW5TY2hlZHVsZWRDaGVja0FuZFB1cmdlQ2FjaGUoKSwgQ2xpZW50LkNBQ0hFX1BVUkdFX0lOVEVSVkFMKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMucHVzaChvYmplY3QpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxscyBfY2hlY2tBbmRQdXJnZUNhY2hlIG9uIGFjY3VtdWxhdGVkIG9iamVjdHMgYW5kIHJlc2V0cyBpdHMgc3RhdGUuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1blNjaGVkdWxlZENoZWNrQW5kUHVyZ2VDYWNoZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3J1blNjaGVkdWxlZENoZWNrQW5kUHVyZ2VDYWNoZSgpIHtcbiAgICBjb25zdCBsaXN0ID0gdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcztcbiAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUl0ZW1zID0gW107XG4gICAgdGhpcy5fY2hlY2tBbmRQdXJnZUNhY2hlKGxpc3QpO1xuICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlQXQgPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIG9iamVjdCBzaG91bGQgY29udGludWUgdG8gYmUgcGFydCBvZiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIFJlc3VsdCBpcyBiYXNlZCBvbiB3aGV0aGVyIHRoZSBvYmplY3QgaXMgcGFydCBvZiB0aGUgZGF0YSBmb3IgYSBRdWVyeS5cbiAgICpcbiAgICogQG1ldGhvZCBfaXNDYWNoZWRPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuUm9vdH0gb2JqIC0gQSBNZXNzYWdlIG9yIENvbnZlcnNhdGlvbiBJbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgX2lzQ2FjaGVkT2JqZWN0KG9iaikge1xuICAgIGNvbnN0IGxpc3QgPSBPYmplY3Qua2V5cyh0aGlzLl9xdWVyaWVzSGFzaCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNIYXNoW2xpc3RbaV1dO1xuICAgICAgaWYgKHF1ZXJ5Ll9nZXRJdGVtKG9iai5pZCkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogT24gcmVzdG9yaW5nIGEgY29ubmVjdGlvbiwgZGV0ZXJtaW5lIHdoYXQgc3RlcHMgbmVlZCB0byBiZSB0YWtlbiB0byB1cGRhdGUgb3VyIGRhdGEuXG4gICAqXG4gICAqIEEgcmVzZXQgYm9vbGVhbiBwcm9wZXJ0eSBpcyBwYXNzZWQ7IHNldCBiYXNlZCBvbiAgbGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvci5SZXNldEFmdGVyT2ZmbGluZUR1cmF0aW9uLlxuICAgKlxuICAgKiBOb3RlIGl0IGlzIHBvc3NpYmxlIGZvciBhbiBhcHBsaWNhdGlvbiB0byBoYXZlIGxvZ2ljIHRoYXQgY2F1c2VzIHF1ZXJpZXMgdG8gYmUgY3JlYXRlZC9kZXN0cm95ZWRcbiAgICogYXMgYSBzaWRlLWVmZmVjdCBvZiBsYXllci5RdWVyeS5yZXNldCBkZXN0cm95aW5nIGFsbCBkYXRhLiBTbyB3ZSBtdXN0IHRlc3QgdG8gc2VlIGlmIHF1ZXJpZXMgZXhpc3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25SZXN0b3JlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc2V0IC0gU2hvdWxkIHRoZSBzZXNzaW9uIHJlc2V0L3JlbG9hZCBhbGwgZGF0YSBvciBhdHRlbXB0IHRvIHJlc3VtZSB3aGVyZSBpdCBsZWZ0IG9mZj9cbiAgICovXG4gIF9jb25uZWN0aW9uUmVzdG9yZWQoZXZ0KSB7XG4gICAgaWYgKGV2dC5yZXNldCkge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdDbGllbnQgQ29ubmVjdGlvbiBSZXN0b3JlZDsgUmVzZXR0aW5nIGFsbCBRdWVyaWVzJyk7XG4gICAgICB0aGlzLmRiTWFuYWdlci5kZWxldGVUYWJsZXMoKCkgPT4ge1xuICAgICAgICB0aGlzLmRiTWFuYWdlci5fb3BlbigpO1xuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl9xdWVyaWVzSGFzaCkuZm9yRWFjaChpZCA9PiB7XG4gICAgICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLl9xdWVyaWVzSGFzaFtpZF07XG4gICAgICAgICAgaWYgKHF1ZXJ5KSBxdWVyeS5yZXNldCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIHNwZWNpZmllZCBvYmplY3QgZnJvbSBjYWNoZVxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuUm9vdH0gIG9iaiAtIEEgTWVzc2FnZSBvciBDb252ZXJzYXRpb24gSW5zdGFuY2VcbiAgICovXG4gIF9yZW1vdmVPYmplY3Qob2JqKSB7XG4gICAgaWYgKG9iaikgb2JqLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lciBpbnN0YW5jZVxuICAgKiBib3VuZCB0byB0aGUgc3BlY2lmaWVkIGRvbSBub2RlLlxuICAgKlxuICAgKiAgICAgIHZhciB0eXBpbmdMaXN0ZW5lciA9IGNsaWVudC5jcmVhdGVUeXBpbmdMaXN0ZW5lcihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbXlUZXh0Qm94JykpO1xuICAgKiAgICAgIHR5cGluZ0xpc3RlbmVyLnNldENvbnZlcnNhdGlvbihteVNlbGVjdGVkQ29udmVyc2F0aW9uKTtcbiAgICpcbiAgICogVXNlIHRoaXMgbWV0aG9kIHRvIGluc3RhbnRpYXRlIGEgbGlzdGVuZXIsIGFuZCBjYWxsXG4gICAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nTGlzdGVuZXIuc2V0Q29udmVyc2F0aW9uIGV2ZXJ5IHRpbWUgeW91IHdhbnQgdG8gY2hhbmdlIHdoaWNoIENvbnZlcnNhdGlvblxuICAgKiBpdCByZXBvcnRzIHlvdXIgdXNlciBpcyB0eXBpbmcgaW50by5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVUeXBpbmdMaXN0ZW5lclxuICAgKiBAcGFyYW0gIHtIVE1MRWxlbWVudH0gaW5wdXROb2RlIC0gVGV4dCBpbnB1dCB0byB3YXRjaCBmb3Iga2V5c3Ryb2tlc1xuICAgKiBAcmV0dXJuIHtsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyfVxuICAgKi9cbiAgY3JlYXRlVHlwaW5nTGlzdGVuZXIoaW5wdXROb2RlKSB7XG4gICAgY29uc3QgVHlwaW5nTGlzdGVuZXIgPSByZXF1aXJlKCcuL3R5cGluZy1pbmRpY2F0b3JzL3R5cGluZy1saXN0ZW5lcicpO1xuICAgIHJldHVybiBuZXcgVHlwaW5nTGlzdGVuZXIoe1xuICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICBpbnB1dDogaW5wdXROb2RlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5cbiAgICpcbiAgICogVGhlIFR5cGluZ1B1Ymxpc2hlciBsZXRzIHlvdSBtYW5hZ2UgeW91ciBUeXBpbmcgSW5kaWNhdG9ycyB3aXRob3V0IHVzaW5nXG4gICAqIHRoZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyLlxuICAgKlxuICAgKiAgICAgIHZhciB0eXBpbmdQdWJsaXNoZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nUHVibGlzaGVyKCk7XG4gICAqICAgICAgdHlwaW5nUHVibGlzaGVyLnNldENvbnZlcnNhdGlvbihteVNlbGVjdGVkQ29udmVyc2F0aW9uKTtcbiAgICogICAgICB0eXBpbmdQdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEKTtcbiAgICpcbiAgICogVXNlIHRoaXMgbWV0aG9kIHRvIGluc3RhbnRpYXRlIGEgbGlzdGVuZXIsIGFuZCBjYWxsXG4gICAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyLnNldENvbnZlcnNhdGlvbiBldmVyeSB0aW1lIHlvdSB3YW50IHRvIGNoYW5nZSB3aGljaCBDb252ZXJzYXRpb25cbiAgICogaXQgcmVwb3J0cyB5b3VyIHVzZXIgaXMgdHlwaW5nIGludG8uXG4gICAqXG4gICAqIFVzZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5zZXRTdGF0ZSB0byBpbmZvcm0gb3RoZXIgdXNlcnMgb2YgeW91ciBjdXJyZW50IHN0YXRlLlxuICAgKiBOb3RlIHRoYXQgdGhlIGBTVEFSVEVEYCBzdGF0ZSBvbmx5IGxhc3RzIGZvciAyLjUgc2Vjb25kcywgc28geW91XG4gICAqIG11c3QgcmVwZWF0ZWRseSBjYWxsIHNldFN0YXRlIGZvciBhcyBsb25nIGFzIHRoaXMgc3RhdGUgc2hvdWxkIGNvbnRpbnVlLlxuICAgKiBUaGlzIGlzIHR5cGljYWxseSBkb25lIGJ5IHNpbXBseSBjYWxsaW5nIGl0IGV2ZXJ5IHRpbWUgYSB1c2VyIGhpdHNcbiAgICogYSBrZXkuXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlVHlwaW5nUHVibGlzaGVyXG4gICAqIEByZXR1cm4ge2xheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyfVxuICAgKi9cbiAgY3JlYXRlVHlwaW5nUHVibGlzaGVyKCkge1xuICAgIGNvbnN0IFR5cGluZ1B1Ymxpc2hlciA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMvdHlwaW5nLXB1Ymxpc2hlcicpO1xuICAgIHJldHVybiBuZXcgVHlwaW5nUHVibGlzaGVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudCB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlIG9mIGEgc3BlY2lmaWVkIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogVHlwaWNhbGx5IHVzZWQgdG8gc2VlIGlmIGFueW9uZSBpcyBjdXJyZW50bHkgdHlwaW5nIHdoZW4gZmlyc3Qgb3BlbmluZyBhIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRUeXBpbmdTdGF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29udmVyc2F0aW9uSWRcbiAgICovXG4gIGdldFR5cGluZ1N0YXRlKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3R5cGluZ0luZGljYXRvcnMuZ2V0U3RhdGUoY29udmVyc2F0aW9uSWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjY2Vzc29yIGZvciBnZXR0aW5nIGEgQ2xpZW50IGJ5IGFwcElkLlxuICAgKlxuICAgKiBNb3N0IGFwcHMgd2lsbCBvbmx5IGhhdmUgb25lIGNsaWVudCxcbiAgICogYW5kIHdpbGwgbm90IG5lZWQgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q2xpZW50XG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBhcHBJZFxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBzdGF0aWMgZ2V0Q2xpZW50KGFwcElkKSB7XG4gICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldChhcHBJZCk7XG4gIH1cblxuICBzdGF0aWMgZGVzdHJveUFsbENsaWVudHMoKSB7XG4gICAgQ2xpZW50UmVnaXN0cnkuZ2V0QWxsKCkuZm9yRWFjaChjbGllbnQgPT4gY2xpZW50LmRlc3Ryb3koKSk7XG4gIH1cblxuICAvKlxuICAgKiBSZWdpc3RlcnMgYSBwbHVnaW4gd2hpY2ggY2FuIGFkZCBjYXBhYmlsaXRpZXMgdG8gdGhlIENsaWVudC5cbiAgICpcbiAgICogQ2FwYWJpbGl0aWVzIG11c3QgYmUgdHJpZ2dlcmVkIGJ5IEV2ZW50cy9FdmVudCBMaXN0ZW5lcnMuXG4gICAqXG4gICAqIFRoaXMgY29uY2VwdCBpcyBhIGJpdCBwcmVtYXR1cmUgYW5kIHVudXNlZC91bnRlc3RlZC4uLlxuICAgKiBBcyBpbXBsZW1lbnRlZCwgaXQgcHJvdmlkZXMgZm9yIGEgcGx1Z2luIHRoYXQgd2lsbCBiZVxuICAgKiBpbnN0YW50aWF0ZWQgYnkgdGhlIENsaWVudCBhbmQgcGFzc2VkIHRoZSBDbGllbnQgYXMgaXRzIHBhcmFtZXRlci5cbiAgICogVGhpcyBhbGxvd3MgZm9yIGEgbGlicmFyeSBvZiBwbHVnaW5zIHRoYXQgY2FuIGJlIHNoYXJlZCBhbW9uZ1xuICAgKiBkaWZmZXJlbnQgY29tcGFuaWVzL3Byb2plY3RzIGJ1dCB0aGF0IGFyZSBvdXRzaWRlIG9mIHRoZSBjb3JlXG4gICAqIGFwcCBsb2dpYy5cbiAgICpcbiAgICogICAgICAvLyBEZWZpbmUgdGhlIHBsdWdpblxuICAgKiAgICAgIGZ1bmN0aW9uIE15UGx1Z2luKGNsaWVudCkge1xuICAgKiAgICAgICAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcbiAgICogICAgICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczphZGQnLCB0aGlzLm9uTWVzc2FnZXNBZGQsIHRoaXMpO1xuICAgKiAgICAgIH1cbiAgICpcbiAgICogICAgICBNeVBsdWdpbi5wcm90b3R5cGUub25NZXNzYWdlc0FkZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAqICAgICAgICAgIHZhciBtZXNzYWdlcyA9IGV2ZW50Lm1lc3NhZ2VzO1xuICAgKiAgICAgICAgICBhbGVydCgnWW91IG5vdyBoYXZlICcgKyBtZXNzYWdlcy5sZW5ndGggICsgJyBtZXNzYWdlcycpO1xuICAgKiAgICAgIH1cbiAgICpcbiAgICogICAgICAvLyBSZWdpc3RlciB0aGUgUGx1Z2luXG4gICAqICAgICAgQ2xpZW50LnJlZ2lzdGVyUGx1Z2luKCdteVBsdWdpbjM0JywgTXlQbHVnaW4pO1xuICAgKlxuICAgKiAgICAgIHZhciBjbGllbnQgPSBuZXcgQ2xpZW50KHthcHBJZDogJ2xheWVyOi8vL2FwcHMvc3RhZ2luZy91dWlkJ30pO1xuICAgKlxuICAgKiAgICAgIC8vIFRyaWdnZXIgdGhlIHBsdWdpbidzIGJlaGF2aW9yXG4gICAqICAgICAgY2xpZW50Lm15UGx1Z2luMzQuYWRkTWVzc2FnZXMoe21lc3NhZ2VzOltdfSk7XG4gICAqXG4gICAqIEBtZXRob2QgcmVnaXN0ZXJQbHVnaW5cbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5hbWUgICAgIFtkZXNjcmlwdGlvbl1cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNsYXNzRGVmIFtkZXNjcmlwdGlvbl1cbiAgICovXG4gIHN0YXRpYyByZWdpc3RlclBsdWdpbihuYW1lLCBjbGFzc0RlZikge1xuICAgIENsaWVudC5wbHVnaW5zW25hbWVdID0gY2xhc3NEZWY7XG4gIH1cblxufVxuXG4vKipcbiAqIEhhc2ggb2YgbGF5ZXIuQ29udmVyc2F0aW9uIG9iamVjdHMgZm9yIHF1aWNrIGxvb2t1cCBieSBpZFxuICpcbiAqIEBwcml2YXRlXG4gKiBAcHJvcGVydHkge09iamVjdH1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fY29udmVyc2F0aW9uc0hhc2ggPSBudWxsO1xuXG4vKipcbiAqIEhhc2ggb2YgbGF5ZXIuTWVzc2FnZSBvYmplY3RzIGZvciBxdWljayBsb29rdXAgYnkgaWRcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fbWVzc2FnZXNIYXNoID0gbnVsbDtcblxuLyoqXG4gKiBIYXNoIG9mIGxheWVyLlF1ZXJ5IG9iamVjdHMgZm9yIHF1aWNrIGxvb2t1cCBieSBpZFxuICpcbiAqIEBwcml2YXRlXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5DbGllbnQucHJvdG90eXBlLl9xdWVyaWVzSGFzaCA9IG51bGw7XG5cbi8qKlxuICogQXJyYXkgb2YgaXRlbXMgdG8gYmUgY2hlY2tlZCB0byBzZWUgaWYgdGhleSBjYW4gYmUgdW5jYWNoZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtsYXllci5Sb290W119XG4gKi9cbkNsaWVudC5wcm90b3R5cGUuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMgPSBudWxsO1xuXG4vKipcbiAqIFRpbWUgdGhhdCB0aGUgbmV4dCBjYWxsIHRvIF9ydW5DaGVja0FuZFB1cmdlQ2FjaGUoKSBpcyBzY2hlZHVsZWQgZm9yIGluIG1zIHNpbmNlIDE5NzAuXG4gKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbkNsaWVudC5wcm90b3R5cGUuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlQXQgPSAwO1xuXG4vKipcbiAqIEdldCB0aGUgdmVyc2lvbiBvZiB0aGUgQ2xpZW50IGxpYnJhcnkuXG4gKlxuICogQHN0YXRpY1xuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ2xpZW50LnZlcnNpb24gPSAnMy4wLjAnO1xuXG4vKipcbiAqIEFueSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSB0aGF0IGlzIHBhcnQgb2YgYSBRdWVyeSdzIHJlc3VsdHMgYXJlIGtlcHQgaW4gbWVtb3J5IGZvciBhcyBsb25nIGFzIGl0XG4gKiByZW1haW5zIGluIHRoYXQgUXVlcnkuICBIb3dldmVyLCB3aGVuIGEgd2Vic29ja2V0IGV2ZW50IGRlbGl2ZXJzIG5ldyBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucyB0aGF0XG4gKiBhcmUgTk9UIHBhcnQgb2YgYSBRdWVyeSwgaG93IGxvbmcgc2hvdWxkIHRoZXkgc3RpY2sgYXJvdW5kIGluIG1lbW9yeT8gIFdoeSBoYXZlIHRoZW0gc3RpY2sgYXJvdW5kP1xuICogUGVyaGFwcyBhbiBhcHAgd2FudHMgdG8gcG9zdCBhIG5vdGlmaWNhdGlvbiBvZiBhIG5ldyBNZXNzYWdlIG9yIENvbnZlcnNhdGlvbi4uLiBhbmQgd2FudHMgdG8ga2VlcFxuICogdGhlIG9iamVjdCBsb2NhbCBmb3IgYSBsaXR0bGUgd2hpbGUuICBEZWZhdWx0IGlzIDEwIG1pbnV0ZXMgYmVmb3JlIGNoZWNraW5nIHRvIHNlZSBpZlxuICogdGhlIG9iamVjdCBpcyBwYXJ0IG9mIGEgUXVlcnkgb3IgY2FuIGJlIHVuY2FjaGVkLiAgVmFsdWUgaXMgaW4gbWlsaXNlY29uZHMuXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5DbGllbnQuQ0FDSEVfUFVSR0VfSU5URVJWQUwgPSAxMCAqIDYwICogMTAwMDtcblxuQ2xpZW50Ll9pZ25vcmVkRXZlbnRzID0gW1xuICAnY29udmVyc2F0aW9uczpsb2FkZWQnLFxuICAnY29udmVyc2F0aW9uczpsb2FkZWQtZXJyb3InLFxuXTtcblxuQ2xpZW50Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG5cbiAgLyoqXG4gICAqIE9uZSBvciBtb3JlIGxheWVyLkNvbnZlcnNhdGlvbiBvYmplY3RzIGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgY2xpZW50LlxuICAgKlxuICAgKiBUaGV5IG1heSBoYXZlIGJlZW4gYWRkZWQgdmlhIHRoZSB3ZWJzb2NrZXQsIG9yIHZpYSB0aGUgdXNlciBjcmVhdGluZ1xuICAgKiBhIG5ldyBDb252ZXJzYXRpb24gbG9jYWxseS5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIGV2dC5jb252ZXJzYXRpb25zLmZvckVhY2goZnVuY3Rpb24oY29udmVyc2F0aW9uKSB7XG4gICAqICAgICAgICAgICAgICBteVZpZXcuYWRkQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbik7XG4gICAqICAgICAgICAgIH0pO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gZXZ0LmNvbnZlcnNhdGlvbnMgLSBBcnJheSBvZiBjb252ZXJzYXRpb25zIGFkZGVkXG4gICAqL1xuICAnY29udmVyc2F0aW9uczphZGQnLFxuXG4gIC8qKlxuICAgKiBPbmUgb3IgbW9yZSBsYXllci5Db252ZXJzYXRpb24gb2JqZWN0cyBoYXZlIGJlZW4gcmVtb3ZlZC5cbiAgICpcbiAgICogQSByZW1vdmVkIENvbnZlcnNhdGlvbiBpcyBub3QgbmVjZXNzYXJpbHkgZGVsZXRlZCwgaXRzIGp1c3RcbiAgICogbm8gbG9uZ2VyIGJlaW5nIGhlbGQgaW4gbG9jYWwgbWVtb3J5LlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdHlwaWNhbGx5IHlvdSB3aWxsIHdhbnQgdGhlIGNvbnZlcnNhdGlvbnM6ZGVsZXRlIGV2ZW50XG4gICAqIHJhdGhlciB0aGFuIGNvbnZlcnNhdGlvbnM6cmVtb3ZlLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpyZW1vdmUnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgZXZ0LmNvbnZlcnNhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICogICAgICAgICAgICAgIG15Vmlldy5yZW1vdmVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uKTtcbiAgICogICAgICAgICAgfSk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbltdfSBldnQuY29udmVyc2F0aW9ucyAtIEFycmF5IG9mIGNvbnZlcnNhdGlvbnMgcmVtb3ZlZFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJyxcblxuICAvKipcbiAgICogVGhlIGNvbnZlcnNhdGlvbiBpcyBub3cgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGFmdGVyIGNyZWF0aW5nIHRoZSBjb252ZXJzYXRpb25cbiAgICogb24gdGhlIHNlcnZlci4gIFRoZSBSZXN1bHQgcHJvcGVydHkgaXMgb25lIG9mOlxuICAgKlxuICAgKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5DUkVBVEVEOiBBIG5ldyBDb252ZXJzYXRpb24gaGFzIGJlZW4gY3JlYXRlZFxuICAgKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5GT1VORDogQSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gaGFzIGJlZW4gZm91bmRcbiAgICogKiBsYXllci5Db252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBidXQgbm90ZSB0aGF0IHRoZSBtZXRhZGF0YSBpcyBOT1Qgd2hhdCB5b3UgcmVxdWVzdGVkLlxuICAgKlxuICAgKiBBbGwgb2YgdGhlc2UgcmVzdWx0cyB3aWxsIGFsc28gbWVhbiB0aGF0IHRoZSB1cGRhdGVkIHByb3BlcnR5IHZhbHVlcyBoYXZlIGJlZW5cbiAgICogY29waWVkIGludG8geW91ciBDb252ZXJzYXRpb24gb2JqZWN0LiAgVGhhdCBtZWFucyB5b3VyIG1ldGFkYXRhIHByb3BlcnR5IG1heSBub1xuICAgKiBsb25nZXIgYmUgaXRzIGluaXRpYWwgdmFsdWU7IGl0IHdpbGwgYmUgdGhlIHZhbHVlIGZvdW5kIG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgc3dpdGNoKGV2dC5yZXN1bHQpIHtcbiAgICogICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkNSRUFURUQ6XG4gICAqICAgICAgICAgICAgICAgICAgYWxlcnQoZXZ0LnRhcmdldC5pZCArICcgQ3JlYXRlZCEnKTtcbiAgICogICAgICAgICAgICAgICAgICBicmVhaztcbiAgICogICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkZPVU5EOlxuICAgKiAgICAgICAgICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuaWQgKyAnIEZvdW5kIScpO1xuICAgKiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgKiAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6XG4gICAqICAgICAgICAgICAgICAgICAgYWxlcnQoZXZ0LnRhcmdldC5pZCArICcgRm91bmQsIGJ1dCBkb2VzIG5vdCBoYXZlIHRoZSByZXF1ZXN0ZWQgbWV0YWRhdGEhJyk7XG4gICAqICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAqICAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LnJlc3VsdFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGFyZ2V0XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpzZW50JyxcblxuICAvKipcbiAgICogQSBjb252ZXJzYXRpb24gZmFpbGVkIHRvIGxvYWQgb3IgY3JlYXRlIG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgYWxlcnQoZXZ0LmRhdGEubWVzc2FnZSk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2dC5kYXRhXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0YXJnZXRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBBIGNvbnZlcnNhdGlvbiBoYWQgYSBjaGFuZ2UgaW4gaXRzIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIFRoaXMgY2hhbmdlIG1heSBoYXZlIGJlZW4gZGVsaXZlcmVkIGZyb20gYSByZW1vdGUgdXNlclxuICAgKiBvciBhcyBhIHJlc3VsdCBvZiBhIGxvY2FsIG9wZXJhdGlvbi5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIHZhciBtZXRhZGF0YUNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignbWV0YWRhdGEnKTtcbiAgICogICAgICAgICAgdmFyIHBhcnRpY2lwYW50Q2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdwYXJ0aWNpcGFudHMnKTtcbiAgICogICAgICAgICAgaWYgKG1ldGFkYXRhQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJUaXRsZShldnQudGFyZ2V0Lm1ldGFkYXRhLnRpdGxlKTtcbiAgICogICAgICAgICAgfVxuICAgKiAgICAgICAgICBpZiAocGFydGljaXBhbnRDaGFuZ2VzLmxlbmd0aCkge1xuICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbmRlclBhcnRpY2lwYW50cyhldnQudGFyZ2V0LnBhcnRpY2lwYW50cyk7XG4gICAqICAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTk9URTogVHlwaWNhbGx5IHN1Y2ggcmVuZGVyaW5nIGlzIGRvbmUgdXNpbmcgRXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2dC50YXJnZXRcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZ0LmNoYW5nZXNcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMubmV3VmFsdWVcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMub2xkVmFsdWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJyxcblxuICAvKipcbiAgICogQSBjYWxsIHRvIGxheWVyLkNvbnZlcnNhdGlvbi5sb2FkIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gZXZ0LnRhcmdldFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyxcblxuICAvKipcbiAgICogQSBuZXcgbWVzc2FnZSBoYXMgYmVlbiByZWNlaXZlZCBmb3Igd2hpY2ggYSBub3RpZmljYXRpb24gbWF5IGJlIHN1aXRhYmxlLlxuICAgKlxuICAgKiBUaGlzIGV2ZW50IGlzIHRyaWdnZXJlZCBmb3IgbWVzc2FnZXMgdGhhdCBhcmU6XG4gICAqXG4gICAqIDEuIEFkZGVkIHZpYSB3ZWJzb2NrZXQgcmF0aGVyIHRoYW4gb3RoZXIgSU9cbiAgICogMi4gTm90IHlldCBiZWVuIG1hcmtlZCBhcyByZWFkXG4gICAqIDMuIE5vdCBzZW50IGJ5IHRoaXMgdXNlclxuICAgKlxuICAgICAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6bm90aWZ5JywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgIG15Tm90aWZ5KGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICB9KVxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQuTWVzc2FnZVxuICAgKi9cbiAgJ21lc3NhZ2VzOm5vdGlmeScsXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2VzIGhhdmUgYmVlbiBhZGRlZCB0byBhIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogTWF5IGFsc28gZmlyZSB3aGVuIG5ldyBBbm5vdW5jZW1lbnRzIGFyZSByZWNlaXZlZC5cbiAgICpcbiAgICogVGhpcyBldmVudCBpcyB0cmlnZ2VyZWQgb25cbiAgICpcbiAgICogKiBjcmVhdGluZy9zZW5kaW5nIGEgbmV3IG1lc3NhZ2VcbiAgICogKiBSZWNlaXZpbmcgYSBuZXcgbGF5ZXIuTWVzc2FnZSBvciBsYXllci5Bbm5vdW5jZW1lbnQgdmlhIHdlYnNvY2tldFxuICAgKiAqIFF1ZXJ5aW5nL2Rvd25sb2FkaW5nIGEgc2V0IG9mIE1lc3NhZ2VzXG4gICAqXG4gICAgICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgZXZ0Lm1lc3NhZ2VzLmZvckVhY2goZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgICAgICAgbXlWaWV3LmFkZE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgKlxuICAgKiBOT1RFOiBTdWNoIHJlbmRlcmluZyB3b3VsZCB0eXBpY2FsbHkgYmUgZG9uZSB1c2luZyBldmVudHMgb24gbGF5ZXIuUXVlcnkuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VbXX0gZXZ0Lm1lc3NhZ2VzXG4gICAqL1xuICAnbWVzc2FnZXM6YWRkJyxcblxuICAvKipcbiAgICogQSBtZXNzYWdlIGhhcyBiZWVuIHJlbW92ZWQgZnJvbSBhIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQSByZW1vdmVkIE1lc3NhZ2UgaXMgbm90IG5lY2Vzc2FyaWx5IGRlbGV0ZWQsXG4gICAqIGp1c3Qgbm8gbG9uZ2VyIGJlaW5nIGhlbGQgaW4gbWVtb3J5LlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdHlwaWNhbGx5IHlvdSB3aWxsIHdhbnQgdGhlIG1lc3NhZ2VzOmRlbGV0ZSBldmVudFxuICAgKiByYXRoZXIgdGhhbiBtZXNzYWdlczpyZW1vdmUuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczpyZW1vdmUnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgZXZ0Lm1lc3NhZ2VzLmZvckVhY2goZnVuY3Rpb24obWVzc2FnZSkge1xuICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbW92ZU1lc3NhZ2UobWVzc2FnZSk7XG4gICAqICAgICAgICAgIH0pO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBOT1RFOiBTdWNoIHJlbmRlcmluZyB3b3VsZCB0eXBpY2FsbHkgYmUgZG9uZSB1c2luZyBldmVudHMgb24gbGF5ZXIuUXVlcnkuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC5tZXNzYWdlXG4gICAqL1xuICAnbWVzc2FnZXM6cmVtb3ZlJyxcblxuICAvKipcbiAgICogQSBtZXNzYWdlIGhhcyBiZWVuIHNlbnQuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczpzZW50JywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuZ2V0VGV4dCgpICsgJyBoYXMgYmVlbiBzZW50Jyk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICovXG4gICdtZXNzYWdlczpzZW50JyxcblxuICAvKipcbiAgICogQSBtZXNzYWdlIGlzIGFib3V0IHRvIGJlIHNlbnQuXG4gICAqXG4gICAqIFVzZWZ1bCBpZiB5b3Ugd2FudCB0b1xuICAgKiBhZGQgcGFydHMgdG8gdGhlIG1lc3NhZ2UgYmVmb3JlIGl0IGdvZXMgb3V0LlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6c2VuZGluZycsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBldnQudGFyZ2V0LmFkZFBhcnQoe1xuICAgKiAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJyxcbiAgICogICAgICAgICAgICAgIGJvZHk6ICd0aGlzIGlzIGp1c3QgYSB0ZXN0J1xuICAgKiAgICAgICAgICB9KTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0LnRhcmdldFxuICAgKi9cbiAgJ21lc3NhZ2VzOnNlbmRpbmcnLFxuXG4gIC8qKlxuICAgKiBTZXJ2ZXIgZmFpbGVkIHRvIHJlY2VpdmUgYSBNZXNzYWdlLlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZXJyb3JcbiAgICovXG4gICdtZXNzYWdlczpzZW50LWVycm9yJyxcblxuICAvKipcbiAgICogQSBtZXNzYWdlIGhhcyBoYWQgYSBjaGFuZ2UgaW4gaXRzIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIFRoaXMgY2hhbmdlIG1heSBoYXZlIGJlZW4gZGVsaXZlcmVkIGZyb20gYSByZW1vdGUgdXNlclxuICAgKiBvciBhcyBhIHJlc3VsdCBvZiBhIGxvY2FsIG9wZXJhdGlvbi5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ21lc3NhZ2VzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICB2YXIgcmVjcGllbnRTdGF0dXNDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ3JlY2lwaWVudFN0YXR1cycpO1xuICAgKiAgICAgICAgICBpZiAocmVjcGllbnRTdGF0dXNDaGFuZ2VzLmxlbmd0aCkge1xuICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbmRlclN0YXR1cyhldnQudGFyZ2V0KTtcbiAgICogICAgICAgICAgfVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBOT1RFOiBTdWNoIHJlbmRlcmluZyB3b3VsZCB0eXBpY2FsbHkgYmUgZG9uZSB1c2luZyBldmVudHMgb24gbGF5ZXIuUXVlcnkuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZ0LmNoYW5nZXNcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMubmV3VmFsdWVcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMub2xkVmFsdWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICAgKi9cbiAgJ21lc3NhZ2VzOmNoYW5nZScsXG5cblxuICAvKipcbiAgICogQSBjYWxsIHRvIGxheWVyLk1lc3NhZ2UubG9hZCBoYXMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseVxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQudGFyZ2V0XG4gICAqL1xuICAnbWVzc2FnZXM6bG9hZGVkJyxcblxuICAvKipcbiAgICogQSBDb252ZXJzYXRpb24gaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhdXNlZCBieSBlaXRoZXIgYSBzdWNjZXNzZnVsIGNhbGwgdG8gbGF5ZXIuQ29udmVyc2F0aW9uLmRlbGV0ZSgpIG9uIHRoZSBDb252ZXJzYXRpb25cbiAgICogb3IgYnkgYSByZW1vdGUgdXNlci5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6ZGVsZXRlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIG15Vmlldy5yZW1vdmVDb252ZXJzYXRpb24oZXZ0LnRhcmdldCk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gZXZ0LnRhcmdldFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6ZGVsZXRlJyxcblxuICAvKipcbiAgICogQSBNZXNzYWdlIGhhcyBiZWVuIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYXVzZWQgYnkgZWl0aGVyIGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGxheWVyLk1lc3NhZ2UuZGVsZXRlKCkgb24gdGhlIE1lc3NhZ2VcbiAgICogb3IgYnkgYSByZW1vdGUgdXNlci5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ21lc3NhZ2VzOmRlbGV0ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBteVZpZXcucmVtb3ZlTWVzc2FnZShldnQudGFyZ2V0KTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0LnRhcmdldFxuICAgKi9cbiAgJ21lc3NhZ2VzOmRlbGV0ZScsXG5cbiAgLyoqXG4gICAqIEEgY2FsbCB0byBsYXllci5JZGVudGl0eS5sb2FkIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICovXG4gICdpZGVudGl0aWVzOmxvYWRlZCcsXG5cbiAgLyoqXG4gICAqIEFuIElkZW50aXR5IGhhcyBoYWQgYSBjaGFuZ2UgaW4gaXRzIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIENoYW5nZXMgb2NjdXIgd2hlbiBuZXcgZGF0YSBhcnJpdmVzIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ2lkZW50aXRpZXM6Y2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIHZhciBkaXNwbGF5TmFtZUNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignZGlzcGxheU5hbWUnKTtcbiAgICogICAgICAgICAgaWYgKGRpc3BsYXlOYW1lQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJTdGF0dXMoZXZ0LnRhcmdldCk7XG4gICAqICAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0LnRhcmdldFxuICAgKiBAcGFyYW0ge09iamVjdFtdfSBldnQuY2hhbmdlc1xuICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5uZXdWYWx1ZVxuICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5vbGRWYWx1ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZ0LmNoYW5nZXMucHJvcGVydHkgLSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGhhcyBjaGFuZ2VkXG4gICAqL1xuICAnaWRlbnRpdGllczpjaGFuZ2UnLFxuXG4gIC8qKlxuICAgKiBJZGVudGl0aWVzIGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBUaGlzIGV2ZW50IGlzIHRyaWdnZXJlZCB3aGVuZXZlciBhIG5ldyBsYXllci5JZGVudGl0eSAoRnVsbCBpZGVudGl0eSBvciBub3QpXG4gICAqIGhhcyBiZWVuIHJlY2VpdmVkIGJ5IHRoZSBDbGllbnQuXG4gICAqXG4gICAgICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOmFkZCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICBldnQuaWRlbnRpdGllcy5mb3JFYWNoKGZ1bmN0aW9uKGlkZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICBteVZpZXcuYWRkSWRlbnRpdHkoaWRlbnRpdHkpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gZXZ0LmlkZW50aXRpZXNcbiAgICovXG4gICdpZGVudGl0aWVzOmFkZCcsXG5cbiAgLyoqXG4gICAqIElkZW50aXRpZXMgaGF2ZSBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBUaGlzIGRvZXMgbm90IHR5cGljYWxseSBvY2N1ci5cbiAgICpcbiAgICAgICAgICBjbGllbnQub24oJ2lkZW50aXRpZXM6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgIGV2dC5pZGVudGl0aWVzLmZvckVhY2goZnVuY3Rpb24oaWRlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgIG15Vmlldy5hZGRJZGVudGl0eShpZGVudGl0eSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBldnQuaWRlbnRpdGllc1xuICAgKi9cbiAgJ2lkZW50aXRpZXM6cmVtb3ZlJyxcblxuICAvKipcbiAgICogQW4gSWRlbnRpdHkgaGFzIGJlZW4gdW5mb2xsb3dlZCBvciBkZWxldGVkLlxuICAgKlxuICAgKiBXZSBkbyBub3QgZGVsZXRlIHN1Y2ggSWRlbnRpdGllcyBlbnRpcmVseSBmcm9tIHRoZSBDbGllbnQgYXNcbiAgICogdGhlcmUgYXJlIHN0aWxsIE1lc3NhZ2VzIGZyb20gdGhlc2UgSWRlbnRpdGllcyB0byBiZSByZW5kZXJlZCxcbiAgICogYnV0IHdlIGRvIGRvd25ncmFkZSB0aGVtIGZyb20gRnVsbCBJZGVudGl0eSB0byBCYXNpYyBJZGVudGl0eS5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHl9IGV2dC50YXJnZXRcbiAgICovXG4gICdpZGVudGl0aWVzOnVuZm9sbG93JyxcblxuXG4gIC8qKlxuICAgKiBBIFR5cGluZyBJbmRpY2F0b3Igc3RhdGUgaGFzIGNoYW5nZWQuXG4gICAqXG4gICAqIEVpdGhlciBhIGNoYW5nZSBoYXMgYmVlbiByZWNlaXZlZFxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIsIG9yIGEgdHlwaW5nIGluZGljYXRvciBzdGF0ZSBoYXMgZXhwaXJlZC5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ3R5cGluZy1pbmRpY2F0b3ItY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIGlmIChldnQuY29udmVyc2F0aW9uSWQgPT09IG15Q29udmVyc2F0aW9uSWQpIHtcbiAgICogICAgICAgICAgICAgIGFsZXJ0KGV2dC50eXBpbmcuam9pbignLCAnKSArICcgYXJlIHR5cGluZycpO1xuICAgKiAgICAgICAgICAgICAgYWxlcnQoZXZ0LnBhdXNlZC5qb2luKCcsICcpICsgJyBhcmUgcGF1c2VkJyk7XG4gICAqICAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBjb252ZXJzYXRpb25JZCAtIElEIG9mIHRoZSBDb252ZXJzYXRpb24gdXNlcnMgYXJlIHR5cGluZyBpbnRvXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IHR5cGluZyAtIEFycmF5IG9mIHVzZXIgSURzIHdobyBhcmUgY3VycmVudGx5IHR5cGluZ1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBwYXVzZWQgLSBBcnJheSBvZiB1c2VyIElEcyB3aG8gYXJlIGN1cnJlbnRseSBwYXVzZWQ7XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIEEgcGF1c2VkIHVzZXIgc3RpbGwgaGFzIHRleHQgaW4gdGhlaXIgdGV4dCBib3guXG4gICAqL1xuICAndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLFxuXG5cbl0uY29uY2F0KENsaWVudEF1dGguX3N1cHBvcnRlZEV2ZW50cyk7XG5cbkNsaWVudC5wbHVnaW5zID0ge307XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KENsaWVudCwgW0NsaWVudCwgJ0NsaWVudCddKTtcbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50O1xuXG4iXX0=
