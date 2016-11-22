'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Message Class represents Messages sent amongst participants
 * of of a Conversation.
 *
 * The simplest way to create and send a message is:
 *
 *      var m = conversation.createMessage('Hello there').send();
 *
 * For conversations that involve notifications (primarily for Android and IOS), the more common pattern is:
 *
 *      var m = conversation.createMessage('Hello there').send({text: "Message from Fred: Hello there"});
 *
 * Typically, rendering would be done as follows:
 *
 *      // Create a layer.Query that loads Messages for the
 *      // specified Conversation.
 *      var query = client.createQuery({
 *        model: Query.Message,
 *        predicate: 'conversation = "' + conversation.id + '"'
 *      });
 *
 *      // Any time the Query's data changes the 'change'
 *      // event will fire.
 *      query.on('change', function(layerEvt) {
 *        renderNewMessages(query.data);
 *      });
 *
 *      // This will call will cause the above event handler to receive
 *      // a change event, and will update query.data.
 *      conversation.createMessage('Hello there').send();
 *
 * The above code will trigger the following events:
 *
 *  * Message Instance fires
 *    * messages:sending: An event that lets you modify the message prior to sending
 *    * messages:sent: The message was received by the server
 *  * Query Instance fires
 *    * change: The query has received a new Message
 *    * change:add: Same as the change event but does not receive other types of change events
 *
 * When creating a Message there are a number of ways to structure it.
 * All of these are valid and create the same exact Message:
 *
 *      // Full API style:
 *      var m = conversation.createMessage({
 *          parts: [new layer.MessagePart({
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          })]
 *      });
 *
 *      // Option 1: Pass in an Object instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: {
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }
 *      });
 *
 *      // Option 2: Pass in an array of Objects instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: [{
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }]
 *      });
 *
 *      // Option 3: Pass in a string (automatically assumes mimeType is text/plain)
 *      // instead of an array of objects.
 *      var m = conversation.createMessage({
 *          parts: 'Hello'
 *      });
 *
 *      // Option 4: Pass in an array of strings (automatically assumes mimeType is text/plain)
 *      var m = conversation.createMessage({
 *          parts: ['Hello']
 *      });
 *
 *      // Option 5: Pass in just a string and nothing else
 *      var m = conversation.createMessage('Hello');
 *
 *      // Option 6: Use addPart.
 *      var m = converseation.createMessage();
 *      m.addPart({body: "hello", mimeType: "text/plain"});
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Message.id: this property is worth being familiar with; it identifies the
 *   Message and can be used in `client.getMessage(id)` to retrieve it
 *   at any time.
 * * layer.Message.internalId: This property makes for a handy unique ID for use in dom nodes.
 *   It is gaurenteed not to change during this session.
 * * layer.Message.isRead: Indicates if the Message has been read yet; set `m.isRead = true`
 *   to tell the client and server that the message has been read.
 * * layer.Message.parts: An array of layer.MessagePart classes representing the contents of the Message.
 * * layer.Message.sentAt: Date the message was sent
 * * layer.Message.sender `userId`: Conversation participant who sent the Message. You may
 *   need to do a lookup on this id in your own servers to find a
 *   displayable name for it.
 *
 * Methods:
 *
 * * layer.Message.send(): Sends the message to the server and the other participants.
 * * layer.Message.on() and layer.Message.off(); event listeners built on top of the `backbone-events-standalone` npm project
 *
 * Events:
 *
 * * `messages:sent`: The message has been received by the server. Can also subscribe to
 *   this event from the layer.Client which is usually simpler.
 *
 * @class  layer.Message
 * @extends layer.Syncable
 */

var Root = require('./root');
var Syncable = require('./syncable');
var MessagePart = require('./message-part');
var LayerError = require('./layer-error');
var Constants = require('./const');
var Util = require('./client-utils');
var ClientRegistry = require('./client-registry');
var Identity = require('./identity');

var Message = function (_Syncable) {
  _inherits(Message, _Syncable);

  /**
   * See layer.Conversation.createMessage()
   *
   * @method constructor
   * @return {layer.Message}
   */
  function Message() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Message);

    // Unless this is a server representation, this is a developer's shorthand;
    // fill in the missing properties around isRead/isUnread before initializing.
    if (!options.fromServer) {
      if ('isUnread' in options) {
        options.isRead = !options.isUnread && !options.is_unread;
      } else {
        options.isRead = true;
      }
    } else {
      options.id = options.fromServer.id;
    }

    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error('clientId property required to create a Message');
    if (options.conversation) options.conversationId = options.conversation.id;

    // Insure __adjustParts is set AFTER clientId is set.
    var parts = options.parts;
    options.parts = null;

    var _this = _possibleConstructorReturn(this, (Message.__proto__ || Object.getPrototypeOf(Message)).call(this, options));

    _this.parts = parts;

    var client = _this.getClient();
    _this.isInitializing = true;
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    } else {
      if (client) _this.sender = client.user;
      _this.sentAt = new Date();
    }

    if (!_this.parts) _this.parts = [];

    _this._disableEvents = true;
    if (!options.fromServer) _this.recipientStatus = {};else _this.__updateRecipientStatus(_this.recipientStatus);
    _this._disableEvents = false;

    _this.isInitializing = false;
    if (options && options.fromServer) {
      client._addMessage(_this);
      var status = _this.recipientStatus[client.user.id];
      if (status && status !== Constants.RECEIPT_STATE.READ && status !== Constants.RECEIPT_STATE.DELIVERED) {
        Util.defer(function () {
          return _this._sendReceipt('delivery');
        });
      }
    }
    return _this;
  }

  /**
   * Get the layer.Conversation associated with this layer.Message.
   *
   * Uses the layer.Message.conversationId.
   *
   * @method getConversation
   * @return {layer.Conversation}
   */


  _createClass(Message, [{
    key: 'getConversation',
    value: function getConversation(load) {
      if (this.conversationId) {
        return ClientRegistry.get(this.clientId).getConversation(this.conversationId, load);
      }
      return null;
    }

    /**
     * Turn input into valid layer.MessageParts.
     *
     * This method is automatically called any time the parts
     * property is set (including during intialization).  This
     * is where we convert strings into MessageParts, and instances
     * into arrays.
     *
     * @method __adjustParts
     * @private
     * @param  {Mixed} parts -- Could be a string, array, object or MessagePart instance
     * @return {layer.MessagePart[]}
     */

  }, {
    key: '__adjustParts',
    value: function __adjustParts(parts) {
      var _this2 = this;

      if (typeof parts === 'string') {
        return [new MessagePart({
          body: parts,
          mimeType: 'text/plain',
          clientId: this.clientId
        })];
      } else if (Array.isArray(parts)) {
        return parts.map(function (part) {
          var result = void 0;
          if (part instanceof MessagePart) {
            result = part;
          } else {
            result = new MessagePart(part);
          }
          result.clientId = _this2.clientId;
          return result;
        });
      } else if (parts && (typeof parts === 'undefined' ? 'undefined' : _typeof(parts)) === 'object') {
        parts.clientId = this.clientId;
        return [new MessagePart(parts)];
      }
    }

    /**
     * Add a layer.MessagePart to this Message.
     *
     * Should only be called on an unsent Message.
     *
     * ```
     * message.addPart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'});
     *
     * // OR
     * message.addPart(new layer.MessagePart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'}));
     * ```
     *
     * @method addPart
     * @param  {layer.MessagePart/Object} part - A layer.MessagePart instance or a `{mimeType: 'text/plain', body: 'Hello'}` formatted Object.
     * @returns {layer.Message} this
     */

  }, {
    key: 'addPart',
    value: function addPart(part) {
      if (part) {
        part.clientId = this.clientId;
        if ((typeof part === 'undefined' ? 'undefined' : _typeof(part)) === 'object') {
          this.parts.push(new MessagePart(part));
        } else if (part instanceof MessagePart) {
          this.parts.push(part);
        }
      }
      return this;
    }

    /**
     * Accessor called whenever the app accesses `message.recipientStatus`.
     *
     * Insures that participants who haven't yet been sent the Message are marked as layer.Constants.RECEIPT_STATE.PENDING
     *
     * @method __getRecipientStatus
     * @param {string} pKey - The actual property key where the value is stored
     * @private
     * @return {Object}
     */

  }, {
    key: '__getRecipientStatus',
    value: function __getRecipientStatus(pKey) {
      var _this3 = this;

      var value = this[pKey] || {};
      var client = this.getClient();
      if (client) {
        (function () {
          var id = client.user.id;
          var conversation = _this3.getConversation(false);
          if (conversation) {
            conversation.participants.forEach(function (participant) {
              if (!value[participant.id]) {
                value[participant.id] = participant.id === id ? Constants.RECEIPT_STATE.READ : Constants.RECEIPT_STATE.PENDING;
              }
            });
          }
        })();
      }
      return value;
    }

    /**
     * Handle changes to the recipientStatus property.
     *
     * Any time the recipientStatus property is set,
     * Recalculate all of the receipt related properties:
     *
     * 1. isRead
     * 2. readStatus
     * 3. deliveryStatus
     *
     * @method __updateRecipientStatus
     * @private
     * @param  {Object} status - Object describing the delivered/read/sent value for each participant
     *
     */

  }, {
    key: '__updateRecipientStatus',
    value: function __updateRecipientStatus(status, oldStatus) {
      var conversation = this.getConversation(false);
      var client = this.getClient();

      if (!conversation || Util.doesObjectMatch(status, oldStatus)) return;

      var id = client.user.id;
      var isSender = this.sender.sessionOwner;
      var userHasRead = status[id] === Constants.RECEIPT_STATE.READ;

      try {
        // -1 so we don't count this user
        var userCount = conversation.participants.length - 1;

        // If sent by this user or read by this user, update isRead/unread
        if (!this.__isRead && (isSender || userHasRead)) {
          this.__isRead = true; // no __updateIsRead event fired
        }

        // Update the readStatus/deliveryStatus properties

        var _getReceiptStatus2 = this._getReceiptStatus(status, id),
            readCount = _getReceiptStatus2.readCount,
            deliveredCount = _getReceiptStatus2.deliveredCount;

        this._setReceiptStatus(readCount, deliveredCount, userCount);
      } catch (error) {}
      // Do nothing


      // Only trigger an event
      // 1. we're not initializing a new Message
      // 2. the user's state has been updated to read; we don't care about updates from other users if we aren't the sender.
      //    We also don't care about state changes to delivered; these do not inform rendering as the fact we are processing it
      //    proves its delivered.
      // 3. The user is the sender; in that case we do care about rendering receipts from other users
      if (!this.isInitializing && oldStatus) {
        var usersStateUpdatedToRead = userHasRead && oldStatus[id] !== Constants.RECEIPT_STATE.READ;
        if (usersStateUpdatedToRead || isSender) {
          this._triggerAsync('messages:change', {
            oldValue: oldStatus,
            newValue: status,
            property: 'recipientStatus'
          });
        }
      }
    }

    /**
     * Get the number of participants who have read and been delivered
     * this Message
     *
     * @method _getReceiptStatus
     * @private
     * @param  {Object} status - Object describing the delivered/read/sent value for each participant
     * @param  {string} id - Identity ID for this user; not counted when reporting on how many people have read/received.
     * @return {Object} result
     * @return {number} result.readCount
     * @return {number} result.deliveredCount
     */

  }, {
    key: '_getReceiptStatus',
    value: function _getReceiptStatus(status, id) {
      var readCount = 0,
          deliveredCount = 0;
      Object.keys(status).filter(function (participant) {
        return participant !== id;
      }).forEach(function (participant) {
        if (status[participant] === Constants.RECEIPT_STATE.READ) {
          readCount++;
          deliveredCount++;
        } else if (status[participant] === Constants.RECEIPT_STATE.DELIVERED) {
          deliveredCount++;
        }
      });

      return {
        readCount: readCount,
        deliveredCount: deliveredCount
      };
    }

    /**
     * Sets the layer.Message.readStatus and layer.Message.deliveryStatus properties.
     *
     * @method _setReceiptStatus
     * @private
     * @param  {number} readCount
     * @param  {number} deliveredCount
     * @param  {number} userCount
     */

  }, {
    key: '_setReceiptStatus',
    value: function _setReceiptStatus(readCount, deliveredCount, userCount) {
      if (readCount === userCount) {
        this.readStatus = Constants.RECIPIENT_STATE.ALL;
      } else if (readCount > 0) {
        this.readStatus = Constants.RECIPIENT_STATE.SOME;
      } else {
        this.readStatus = Constants.RECIPIENT_STATE.NONE;
      }
      if (deliveredCount === userCount) {
        this.deliveryStatus = Constants.RECIPIENT_STATE.ALL;
      } else if (deliveredCount > 0) {
        this.deliveryStatus = Constants.RECIPIENT_STATE.SOME;
      } else {
        this.deliveryStatus = Constants.RECIPIENT_STATE.NONE;
      }
    }

    /**
     * Handle changes to the isRead property.
     *
     * If someone called m.isRead = true, AND
     * if it was previously false, AND
     * if the call didn't come from layer.Message.__updateRecipientStatus,
     * Then notify the server that the message has been read.
     *
     *
     * @method __updateIsRead
     * @private
     * @param  {boolean} value - True if isRead is true.
     */

  }, {
    key: '__updateIsRead',
    value: function __updateIsRead(value) {
      if (value) {
        if (!this._inPopulateFromServer) {
          this._sendReceipt(Constants.RECEIPT_STATE.READ);
        }
        this._triggerMessageRead();
        var conversation = this.getConversation(false);
        if (conversation) conversation.unreadCount--;
      }
    }

    /**
     * Trigger events indicating changes to the isRead/isUnread properties.
     *
     * @method _triggerMessageRead
     * @private
     */

  }, {
    key: '_triggerMessageRead',
    value: function _triggerMessageRead() {
      var value = this.isRead;
      this._triggerAsync('messages:change', {
        property: 'isRead',
        oldValue: !value,
        newValue: value
      });
      this._triggerAsync('messages:change', {
        property: 'isUnread',
        oldValue: value,
        newValue: !value
      });
    }

    /**
     * Send a Read or Delivery Receipt to the server.
     *
     * For Read Receipt, you can also just write:
     *
     * ```
     * message.isRead = true;
     * ```
     *
     * You can retract a Delivery or Read Receipt; once marked as Delivered or Read, it can't go back.
     *
     * ```
     * messsage.sendReceipt(layer.Constants.RECEIPT_STATE.READ);
     * ```
     *
     * @method sendReceipt
     * @param {string} [type=layer.Constants.RECEIPT_STATE.READ] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     * @return {layer.Message} this
     */

  }, {
    key: 'sendReceipt',
    value: function sendReceipt() {
      var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Constants.RECEIPT_STATE.READ;

      if (type === Constants.RECEIPT_STATE.READ) {
        if (this.isRead) {
          return this;
        } else {
          // Without triggering the event, clearObject isn't called,
          // which means those using the toObject() data will have an isRead that doesn't match
          // this instance.  Which typically leads to lots of extra attempts
          // to mark the message as read.
          this.__isRead = true;
          this._triggerMessageRead();
          var conversation = this.getConversation(false);
          if (conversation) conversation.unreadCount--;
        }
      }
      this._sendReceipt(type);
      return this;
    }

    /**
     * Send a Read or Delivery Receipt to the server.
     *
     * This bypasses any validation and goes direct to sending to the server.
     *
     * NOTE: Server errors are not handled; the local receipt state is suitable even
     * if out of sync with the server.
     *
     * @method _sendReceipt
     * @private
     * @param {string} [type=read] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     */

  }, {
    key: '_sendReceipt',
    value: function _sendReceipt(type) {
      var _this4 = this;

      // This little test exists so that we don't send receipts on Conversations we are no longer
      // participants in (participants = [] if we are not a participant)
      var conversation = this.getConversation(false);
      if (conversation && conversation.participants.length === 0) return;

      this._setSyncing();
      this._xhr({
        url: '/receipts',
        method: 'POST',
        data: {
          type: type
        },
        sync: {
          // This should not be treated as a POST/CREATE request on the Message
          operation: 'RECEIPT'
        }
      }, function () {
        return _this4._setSynced();
      });
    }

    /**
     * Send the message to all participants of the Conversation.
     *
     * Message must have parts and a valid conversation to send successfully.
     *
     * The send method takes a `notification` object. In normal use, it provides the same notification to ALL
     * recipients, but you can customize notifications on a per recipient basis, as well as embed actions into the notification.
     * For the Full API, see https://developer.layer.com/docs/platform/messages#notification-customization.
     *
     * For the Full API, see [Server Docs](https://developer.layer.com/docs/platform/messages#notification-customization).
     *
     * ```
     * message.send({
     *    title: "New Hobbit Message",
     *    text: "Frodo-the-Dodo: Hello Sam, what say we waltz into Mordor like we own the place?",
     *    sound: "whinyhobbit.aiff"
     * });
     * ```
     *
     * @method send
     * @param {Object} [notification] - Parameters for controling how the phones manage notifications of the new Message.
     *                          See IOS and Android docs for details.
     * @param {string} [notification.title] - Title to show on lock screen and notification bar
     * @param {string} [notification.text] - Text of your notification
     * @param {string} [notification.sound] - Name of an audio file or other sound-related hint
     * @return {layer.Message} this
     */

  }, {
    key: 'send',
    value: function send(notification) {
      var _this5 = this;

      var client = this.getClient();
      if (!client) {
        throw new Error(LayerError.dictionary.clientMissing);
      }

      var conversation = this.getConversation(true);

      if (!conversation) {
        throw new Error(LayerError.dictionary.conversationMissing);
      }

      if (this.syncState !== Constants.SYNC_STATE.NEW) {
        throw new Error(LayerError.dictionary.alreadySent);
      }

      if (conversation.isLoading) {
        conversation.once('conversations:loaded', function () {
          return _this5.send(notification);
        });
        return this;
      }

      if (!this.parts || !this.parts.length) {
        throw new Error(LayerError.dictionary.partsMissing);
      }

      this._setSyncing();

      // Make sure that the Conversation has been created on the server
      // and update the lastMessage property
      conversation.send(this);

      // If we are sending any File/Blob objects, and their Mime Types match our test,
      // wait until the body is updated to be a string rather than File before calling _addMessage
      // which will add it to the Query Results and pass this on to a renderer that expects "text/plain" to be a string
      // rather than a blob.
      this._readAllBlobs(function () {
        // Calling this will add this to any listening Queries... so position needs to have been set first;
        // handled in conversation.send(this)
        client._addMessage(_this5);

        // allow for modification of message before sending
        _this5.trigger('messages:sending');

        var data = {
          parts: new Array(_this5.parts.length),
          id: _this5.id
        };
        if (notification) data.notification = notification;

        _this5._preparePartsForSending(data);
      });
      return this;
    }

    /**
     * Any MessagePart that contains a textual blob should contain a string before we send.
     *
     * If a MessagePart with a Blob or File as its body were to be added to the Client,
     * The Query would receive this, deliver it to apps and the app would crash.
     * Most rendering code expecting text/plain would expect a string not a File.
     *
     * When this user is sending a file, and that file is textual, make sure
     * its actual text delivered to the UI.
     *
     * @method _readAllBlobs
     * @private
     */

  }, {
    key: '_readAllBlobs',
    value: function _readAllBlobs(callback) {
      var count = 0;
      var parts = this.parts.filter(function (part) {
        return Util.isBlob(part.body) && part.isTextualMimeType();
      });
      parts.forEach(function (part) {
        Util.fetchTextFromFile(part.body, function (text) {
          part.body = text;
          count++;
          if (count === parts.length) callback();
        });
      });
      if (!parts.length) callback();
    }

    /**
     * Insures that each part is ready to send before actually sending the Message.
     *
     * @method _preparePartsForSending
     * @private
     * @param  {Object} structure to be sent to the server
     */

  }, {
    key: '_preparePartsForSending',
    value: function _preparePartsForSending(data) {
      var _this6 = this;

      var client = this.getClient();
      var count = 0;
      this.parts.forEach(function (part, index) {
        part.once('parts:send', function (evt) {
          data.parts[index] = {
            mime_type: evt.mime_type
          };
          if (evt.content) data.parts[index].content = evt.content;
          if (evt.body) data.parts[index].body = evt.body;
          if (evt.encoding) data.parts[index].encoding = evt.encoding;

          count++;
          if (count === _this6.parts.length) {
            _this6._send(data);
          }
        }, _this6);
        part._send(client);
      });
    }

    /**
     * Handle the actual sending.
     *
     * layer.Message.send has some potentially asynchronous
     * preprocessing to do before sending (Rich Content); actual sending
     * is done here.
     *
     * @method _send
     * @private
     */

  }, {
    key: '_send',
    value: function _send(data) {
      var _this7 = this;

      var client = this.getClient();
      var conversation = this.getConversation(false);

      this.sentAt = new Date();
      client.sendSocketRequest({
        method: 'POST',
        body: {
          method: 'Message.create',
          object_id: conversation.id,
          data: data
        },
        sync: {
          depends: [this.conversationId, this.id],
          target: this.id
        }
      }, function (success, socketData) {
        return _this7._sendResult(success, socketData);
      });
    }
  }, {
    key: '_getSendData',
    value: function _getSendData(data) {
      data.object_id = this.conversationId;
      return data;
    }

    /**
      * layer.Message.send() Success Callback.
      *
      * If successfully sending the message; triggers a 'sent' event,
      * and updates the message.id/url
      *
      * @method _sendResult
      * @private
      * @param {Object} messageData - Server description of the message
      */

  }, {
    key: '_sendResult',
    value: function _sendResult(_ref) {
      var success = _ref.success,
          data = _ref.data;

      if (this.isDestroyed) return;

      if (success) {
        this._populateFromServer(data);
        this._triggerAsync('messages:sent');
      } else {
        this.trigger('messages:sent-error', { error: data });
        this.destroy();
      }
      this._setSynced();
    }

    /* NOT FOR JSDUCK
     * Standard `on()` provided by layer.Root.
     *
     * Adds some special handling of 'messages:loaded' so that calls such as
     *
     *      var m = client.getMessage('layer:///messages/123', true)
     *      .on('messages:loaded', function() {
     *          myrerender(m);
     *      });
     *      myrender(m); // render a placeholder for m until the details of m have loaded
     *
     * can fire their callback regardless of whether the client loads or has
     * already loaded the Message.
     *
     * @method on
     * @param  {string} eventName
     * @param  {Function} eventHandler
     * @param  {Object} context
     * @return {layer.Message} this
     */

  }, {
    key: 'on',
    value: function on(name, callback, context) {
      var hasLoadedEvt = name === 'messages:loaded' || name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object' && name['messages:loaded'];

      if (hasLoadedEvt && !this.isLoading) {
        (function () {
          var callNow = name === 'messages:loaded' ? callback : name['messages:loaded'];
          Util.defer(function () {
            return callNow.apply(context);
          });
        })();
      }
      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'on', this).call(this, name, callback, context);
      return this;
    }

    /**
     * Delete the Message from the server.
     *
     * This call will support various deletion modes.  Calling without a deletion mode is deprecated.
     *
     * Deletion Modes:
     *
     * * layer.Constants.DELETION_MODE.ALL: This deletes the local copy immediately, and attempts to also
     *   delete the server's copy.
     * * layer.Constants.DELETION_MODE.MY_DEVICES: Deletes this Message from all of my devices; no effect on other users.
     *
     * @method delete
     * @param {String} deletionMode
     */

  }, {
    key: 'delete',
    value: function _delete(mode) {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);

      var queryStr = void 0;
      switch (mode) {
        case Constants.DELETION_MODE.ALL:
        case true:
          queryStr = 'mode=all_participants';
          break;
        case Constants.DELETION_MODE.MY_DEVICES:
          queryStr = 'mode=my_devices';
          break;
        default:
          throw new Error(LayerError.dictionary.deletionModeUnsupported);
      }

      var id = this.id;
      var client = this.getClient();
      this._xhr({
        url: '?' + queryStr,
        method: 'DELETE'
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Message.load(id, client);
      });

      this._deleted();
      this.destroy();
    }

    /**
     * Remove this Message from the system.
     *
     * This will deregister the Message, remove all events
     * and allow garbage collection.
     *
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      var client = this.getClient();
      if (client) client._removeMessage(this);
      this.parts.forEach(function (part) {
        return part.destroy();
      });
      this.__parts = null;

      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'destroy', this).call(this);
    }

    /**
     * Populates this instance with the description from the server.
     *
     * Can be used for creating or for updating the instance.
     *
     * @method _populateFromServer
     * @protected
     * @param  {Object} m - Server description of the message
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(message) {
      var _this8 = this;

      this._inPopulateFromServer = true;
      var client = this.getClient();

      this.id = message.id;
      this.url = message.url;
      var oldPosition = this.position;
      this.position = message.position;

      // Assign IDs to preexisting Parts so that we can call getPartById()
      if (this.parts) {
        this.parts.forEach(function (part, index) {
          if (!part.id) part.id = _this8.id + '/parts/' + index;
        });
      }

      this.parts = message.parts.map(function (part) {
        var existingPart = _this8.getPartById(part.id);
        if (existingPart) {
          existingPart._populateFromServer(part);
          return existingPart;
        } else {
          return MessagePart._createFromServer(part);
        }
      });

      this.recipientStatus = message.recipient_status || {};

      this.isRead = !message.is_unread;

      this.sentAt = new Date(message.sent_at);
      this.receivedAt = message.received_at ? new Date(message.received_at) : undefined;

      var sender = void 0;
      if (message.sender.id) {
        sender = client.getIdentity(message.sender.id);
      }

      // Because there may be no ID, we have to bypass client._createObject and its switch statement.
      if (!sender) {
        sender = Identity._createFromServer(message.sender, client);
      }
      this.sender = sender;

      this._setSynced();

      if (oldPosition && oldPosition !== this.position) {
        this._triggerAsync('messages:change', {
          oldValue: oldPosition,
          newValue: this.position,
          property: 'position'
        });
      }
      this._inPopulateFromServer = false;
    }

    /**
     * Returns the Message's layer.MessagePart with the specified the part ID.
     *
     * ```
     * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
     * ```
     *
     * @method getPartById
     * @param {string} partId
     * @return {layer.MessagePart}
     */

  }, {
    key: 'getPartById',
    value: function getPartById(partId) {
      var part = this.parts ? this.parts.filter(function (aPart) {
        return aPart.id === partId;
      })[0] : null;
      return part || null;
    }

    /**
     * Accepts json-patch operations for modifying recipientStatus.
     *
     * @method _handlePatchEvent
     * @private
     * @param  {Object[]} data - Array of operations
     */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      this._inLayerParser = false;
      if (paths[0].indexOf('recipient_status') === 0) {
        this.__updateRecipientStatus(this.recipientStatus, oldValue);
      }
      this._inLayerParser = true;
    }

    /**
     * Returns absolute URL for this resource.
     * Used by sync manager because the url may not be known
     * at the time the sync request is enqueued.
     *
     * @method _getUrl
     * @param {String} url - relative url and query string parameters
     * @return {String} full url
     * @private
     */

  }, {
    key: '_getUrl',
    value: function _getUrl(url) {
      return this.url + (url || '');
    }
  }, {
    key: '_setupSyncObject',
    value: function _setupSyncObject(sync) {
      if (sync !== false) {
        sync = _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), '_setupSyncObject', this).call(this, sync);
        if (!sync.depends) {
          sync.depends = [this.conversationId];
        } else if (sync.depends.indexOf(this.id) === -1) {
          sync.depends.push(this.conversationId);
        }
      }
      return sync;
    }

    /**
     * Get all text parts of the Message.
     *
     * Utility method for extracting all of the text/plain parts
     * and concatenating all of their bodys together into a single string.
     *
     * @method getText
     * @param {string} [joinStr='.  '] If multiple message parts of type text/plain, how do you want them joined together?
     * @return {string}
     */

  }, {
    key: 'getText',
    value: function getText() {
      var joinStr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '. ';

      var textArray = this.parts.filter(function (part) {
        return part.mimeType === 'text/plain';
      }).map(function (part) {
        return part.body;
      });
      textArray = textArray.filter(function (data) {
        return data;
      });
      return textArray.join(joinStr);
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Message instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this object.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'toObject', this).call(this);
        this._toObject.recipientStatus = Util.clone(this.recipientStatus);
      }
      return this._toObject;
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Creates a message from the server's representation of a message.
     *
     * Similar to _populateFromServer, however, this method takes a
     * message description and returns a new message instance using _populateFromServer
     * to setup the values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} message - Server's representation of the message
     * @param  {layer.Client} client
     * @return {layer.Message}
     */

  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.conversationId = data.conversation.id;
      this.getClient()._addMessage(this);
    }

    /**
     * Identifies whether a Message receiving the specified patch data should be loaded from the server.
     *
     * Applies only to Messages that aren't already loaded; used to indicate if a change event is
     * significant enough to load the Message and trigger change events on that Message.
     *
     * At this time there are no properties that are patched on Messages via websockets
     * that would justify loading the Message from the server so as to notify the app.
     *
     * Only recipient status changes and maybe is_unread changes are sent;
     * neither of which are relevant to an app that isn't rendering that message.
     *
     * @method _loadResourceForPatch
     * @static
     * @private
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      return new Message({
        conversationId: message.conversation.id,
        fromServer: message,
        clientId: client.appId,
        _fromDB: message._fromDB,
        _notify: fromWebsocket && message.is_unread && message.sender.user_id !== client.user.userId
      });
    }
  }, {
    key: '_loadResourceForPatch',
    value: function _loadResourceForPatch(patchData) {
      return false;
    }
  }]);

  return Message;
}(Syncable);

/**
 * Client that the Message belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @readonly
 */


Message.prototype.clientId = '';

/**
 * Conversation that this Message belongs to.
 *
 * Actual value is the ID of the Conversation's ID.
 *
 * @type {string}
 * @readonly
 */
Message.prototype.conversationId = '';

/**
 * Array of layer.MessagePart objects.
 *
 * Use layer.Message.addPart to modify this array.
 *
 * @type {layer.MessagePart[]}
 * @readonly
 */
Message.prototype.parts = null;

/**
 * Time that the message was sent.
 *
 *  Note that a locally created layer.Message will have a `sentAt` value even
 * though its not yet sent; this is so that any rendering code doesn't need
 * to account for `null` values.  Sending the Message may cause a slight change
 * in the `sentAt` value.
 *
 * @type {Date}
 * @readonly
 */
Message.prototype.sentAt = null;

/**
 * Time that the first delivery receipt was sent by your
 * user acknowledging receipt of the message.
 * @type {Date}
 * @readonly
 */
Message.prototype.receivedAt = null;

/**
 * Identity object representing the sender of the Message.
 *
 * Most commonly used properties of Identity are:
 * * displayName: A name for your UI
 * * userId: Name for the user as represented on your system
 * * name: Represents the name of a service if the sender was an automated system.
 *
 *      <span class='sent-by'>
 *        {message.sender.displayName || message.sender.name}
 *      </span>
 *
 * @type {layer.Identity}
 * @readonly
 */
Message.prototype.sender = null;

/**
 * Position of this message within the conversation.
 *
 * NOTES:
 *
 * 1. Deleting a message does not affect position of other Messages.
 * 2. A position is not gaurenteed to be unique (multiple messages sent at the same time could
 * all claim the same position)
 * 3. Each successive message within a conversation should expect a higher position.
 *
 * @type {Number}
 * @readonly
 */
Message.prototype.position = 0;

/**
 * Hint used by layer.Client on whether to trigger a messages:notify event.
 *
 * @type {boolean}
 * @private
 */
Message.prototype._notify = false;

/* Recipient Status */

/**
 * Read/delivery State of all participants.
 *
 * This is an object containing keys for each participant,
 * and a value of:
 * * layer.RECEIPT_STATE.SENT
 * * layer.RECEIPT_STATE.DELIVERED
 * * layer.RECEIPT_STATE.READ
 * * layer.RECEIPT_STATE.PENDING
 *
 * @type {Object}
 */
Message.prototype.recipientStatus = null;

/**
 * True if this Message has been read by this user.
 *
 * You can change isRead programatically
 *
 *      m.isRead = true;
 *
 * This will automatically notify the server that the message was read by your user.
 * @type {Boolean}
 */
Message.prototype.isRead = false;

/**
 * This property is here for convenience only; it will always be the opposite of isRead.
 * @type {Boolean}
 * @readonly
 */
Object.defineProperty(Message.prototype, 'isUnread', {
  enumerable: true,
  get: function get() {
    return !this.isRead;
  }
});

/**
 * Have the other participants read this Message yet.
 *
 * This value is one of:
 *
 *  * layer.Constants.RECIPIENT_STATE.ALL
 *  * layer.Constants.RECIPIENT_STATE.SOME
 *  * layer.Constants.RECIPIENT_STATE.NONE
 *
 *  This value is updated any time recipientStatus changes.
 *
 * See layer.Message.recipientStatus for a more detailed report.
 *
 * @type {String}
 */
Message.prototype.readStatus = Constants.RECIPIENT_STATE.NONE;

/**
 * Have the other participants received this Message yet.
 *
  * This value is one of:
 *
 *  * layer.Constants.RECIPIENT_STATE.ALL
 *  * layer.Constants.RECIPIENT_STATE.SOME
 *  * layer.Constants.RECIPIENT_STATE.NONE
 *
 *  This value is updated any time recipientStatus changes.
 *
 * See layer.Message.recipientStatus for a more detailed report.
 *
 *
 * @type {String}
 */
Message.prototype.deliveryStatus = Constants.RECIPIENT_STATE.NONE;

Message.prototype._toObject = null;

Message.prototype._inPopulateFromServer = false;

Message.eventPrefix = 'messages';

Message.eventPrefix = 'messages';

Message.prefixUUID = 'layer:///messages/';

Message.inObjectIgnore = Syncable.inObjectIgnore;

Message.bubbleEventParent = 'getClient';

Message.imageTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg'];

Message._supportedEvents = [

/**
 * Message has been loaded from the server.
 *
 * Note that this is only used in response to the layer.Message.load() method.
 *
 * ```
 * var m = client.getMessage('layer:///messages/123', true)
 *    .on('messages:loaded', function() {
 *        myrerender(m);
 *    });
 * myrender(m); // render a placeholder for m until the details of m have loaded
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:loaded',

/**
 * The load method failed to load the message from the server.
 *
 * Note that this is only used in response to the layer.Message.load() method.
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:loaded-error',

/**
 * Message deleted from the server.
 *
 * Caused by a call to layer.Message.delete() or a websocket event.
 * @param {layer.LayerEvent} evt
 * @event
 */
'messages:delete',

/**
 * Message is about to be sent.
 *
 * Last chance to modify or validate the message prior to sending.
 *
 *     message.on('messages:sending', function(evt) {
 *        message.addPart({mimeType: 'application/location', body: JSON.stringify(getGPSLocation())});
 *     });
 *
 * Typically, you would listen to this event more broadly using `client.on('messages:sending')`
 * which would trigger before sending ANY Messages.
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:sending',

/**
 * Message has been received by the server.
 *
 * It does NOT indicate delivery to other users.
 *
 * It does NOT indicate messages sent by other users.
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:sent',

/**
 * Server failed to receive the Message.
 *
 * Message will be deleted immediately after firing this event.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.error
 */
'messages:sent-error',

/**
 * The recipientStatus property has changed.
 *
 * This happens in response to an update
 * from the server... but is also caused by marking the current user as having read
 * or received the message.
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Message, [Message, 'Message']);
Syncable.subclasses.push(Message);
module.exports = Message;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tZXNzYWdlLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiU3luY2FibGUiLCJNZXNzYWdlUGFydCIsIkxheWVyRXJyb3IiLCJDb25zdGFudHMiLCJVdGlsIiwiQ2xpZW50UmVnaXN0cnkiLCJJZGVudGl0eSIsIk1lc3NhZ2UiLCJvcHRpb25zIiwiZnJvbVNlcnZlciIsImlzUmVhZCIsImlzVW5yZWFkIiwiaXNfdW5yZWFkIiwiaWQiLCJjbGllbnQiLCJjbGllbnRJZCIsImFwcElkIiwiRXJyb3IiLCJjb252ZXJzYXRpb24iLCJjb252ZXJzYXRpb25JZCIsInBhcnRzIiwiZ2V0Q2xpZW50IiwiaXNJbml0aWFsaXppbmciLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwic2VuZGVyIiwidXNlciIsInNlbnRBdCIsIkRhdGUiLCJfZGlzYWJsZUV2ZW50cyIsInJlY2lwaWVudFN0YXR1cyIsIl9fdXBkYXRlUmVjaXBpZW50U3RhdHVzIiwiX2FkZE1lc3NhZ2UiLCJzdGF0dXMiLCJSRUNFSVBUX1NUQVRFIiwiUkVBRCIsIkRFTElWRVJFRCIsImRlZmVyIiwiX3NlbmRSZWNlaXB0IiwibG9hZCIsImdldCIsImdldENvbnZlcnNhdGlvbiIsImJvZHkiLCJtaW1lVHlwZSIsIkFycmF5IiwiaXNBcnJheSIsIm1hcCIsInJlc3VsdCIsInBhcnQiLCJwdXNoIiwicEtleSIsInZhbHVlIiwicGFydGljaXBhbnRzIiwiZm9yRWFjaCIsInBhcnRpY2lwYW50IiwiUEVORElORyIsIm9sZFN0YXR1cyIsImRvZXNPYmplY3RNYXRjaCIsImlzU2VuZGVyIiwic2Vzc2lvbk93bmVyIiwidXNlckhhc1JlYWQiLCJ1c2VyQ291bnQiLCJsZW5ndGgiLCJfX2lzUmVhZCIsIl9nZXRSZWNlaXB0U3RhdHVzIiwicmVhZENvdW50IiwiZGVsaXZlcmVkQ291bnQiLCJfc2V0UmVjZWlwdFN0YXR1cyIsImVycm9yIiwidXNlcnNTdGF0ZVVwZGF0ZWRUb1JlYWQiLCJfdHJpZ2dlckFzeW5jIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsInByb3BlcnR5IiwiT2JqZWN0Iiwia2V5cyIsImZpbHRlciIsInJlYWRTdGF0dXMiLCJSRUNJUElFTlRfU1RBVEUiLCJBTEwiLCJTT01FIiwiTk9ORSIsImRlbGl2ZXJ5U3RhdHVzIiwiX2luUG9wdWxhdGVGcm9tU2VydmVyIiwiX3RyaWdnZXJNZXNzYWdlUmVhZCIsInVucmVhZENvdW50IiwidHlwZSIsIl9zZXRTeW5jaW5nIiwiX3hociIsInVybCIsIm1ldGhvZCIsImRhdGEiLCJzeW5jIiwib3BlcmF0aW9uIiwiX3NldFN5bmNlZCIsIm5vdGlmaWNhdGlvbiIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiY29udmVyc2F0aW9uTWlzc2luZyIsInN5bmNTdGF0ZSIsIlNZTkNfU1RBVEUiLCJORVciLCJhbHJlYWR5U2VudCIsImlzTG9hZGluZyIsIm9uY2UiLCJzZW5kIiwicGFydHNNaXNzaW5nIiwiX3JlYWRBbGxCbG9icyIsInRyaWdnZXIiLCJfcHJlcGFyZVBhcnRzRm9yU2VuZGluZyIsImNhbGxiYWNrIiwiY291bnQiLCJpc0Jsb2IiLCJpc1RleHR1YWxNaW1lVHlwZSIsImZldGNoVGV4dEZyb21GaWxlIiwidGV4dCIsImluZGV4IiwibWltZV90eXBlIiwiZXZ0IiwiY29udGVudCIsImVuY29kaW5nIiwiX3NlbmQiLCJzZW5kU29ja2V0UmVxdWVzdCIsIm9iamVjdF9pZCIsImRlcGVuZHMiLCJ0YXJnZXQiLCJzdWNjZXNzIiwic29ja2V0RGF0YSIsIl9zZW5kUmVzdWx0IiwiaXNEZXN0cm95ZWQiLCJkZXN0cm95IiwibmFtZSIsImNvbnRleHQiLCJoYXNMb2FkZWRFdnQiLCJjYWxsTm93IiwiYXBwbHkiLCJtb2RlIiwicXVlcnlTdHIiLCJERUxFVElPTl9NT0RFIiwiTVlfREVWSUNFUyIsImRlbGV0aW9uTW9kZVVuc3VwcG9ydGVkIiwiX2RlbGV0ZWQiLCJfcmVtb3ZlTWVzc2FnZSIsIl9fcGFydHMiLCJtZXNzYWdlIiwib2xkUG9zaXRpb24iLCJwb3NpdGlvbiIsImV4aXN0aW5nUGFydCIsImdldFBhcnRCeUlkIiwiX2NyZWF0ZUZyb21TZXJ2ZXIiLCJyZWNpcGllbnRfc3RhdHVzIiwic2VudF9hdCIsInJlY2VpdmVkQXQiLCJyZWNlaXZlZF9hdCIsInVuZGVmaW5lZCIsImdldElkZW50aXR5IiwicGFydElkIiwiYVBhcnQiLCJwYXRocyIsIl9pbkxheWVyUGFyc2VyIiwiaW5kZXhPZiIsImpvaW5TdHIiLCJ0ZXh0QXJyYXkiLCJqb2luIiwiX3RvT2JqZWN0IiwiY2xvbmUiLCJldnROYW1lIiwiYXJncyIsIl9jbGVhck9iamVjdCIsImZyb21XZWJzb2NrZXQiLCJfZnJvbURCIiwiX25vdGlmeSIsInVzZXJfaWQiLCJ1c2VySWQiLCJwYXRjaERhdGEiLCJwcm90b3R5cGUiLCJkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiLCJldmVudFByZWZpeCIsInByZWZpeFVVSUQiLCJpbk9iamVjdElnbm9yZSIsImJ1YmJsZUV2ZW50UGFyZW50IiwiaW1hZ2VUeXBlcyIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJzdWJjbGFzc2VzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvSEEsSUFBTUEsT0FBT0MsUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNQyxXQUFXRCxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNRSxjQUFjRixRQUFRLGdCQUFSLENBQXBCO0FBQ0EsSUFBTUcsYUFBYUgsUUFBUSxlQUFSLENBQW5CO0FBQ0EsSUFBTUksWUFBWUosUUFBUSxTQUFSLENBQWxCO0FBQ0EsSUFBTUssT0FBT0wsUUFBUSxnQkFBUixDQUFiO0FBQ0EsSUFBTU0saUJB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SUFBOUI7O0FBRUE1SixRQUFRdUssU0FBUixDQUFrQjVGLHFCQUFsQixHQUEwQyxLQUExQzs7QUFFQTNFLFFBQVEwSyxXQUFSLEdBQXNCLFVBQXRCOztBQUVBMUssUUFBUTBLLFdBQVIsR0FBc0IsVUFBdEI7O0FBRUExSyxRQUFRMkssVUFBUixHQUFxQixvQkFBckI7O0FBRUEzSyxRQUFRNEssY0FBUixHQUF5Qm5MLFNBQVNtTCxjQUFsQzs7QUFFQTVLLFFBQVE2SyxpQkFBUixHQUE0QixXQUE1Qjs7QUFFQTdLLFFBQVE4SyxVQUFSLEdBQXFCLENBQ25CLFdBRG1CLEVBRW5CLFdBRm1CLEVBR25CLFlBSG1CLEVBSW5CLFdBSm1CLENBQXJCOztBQU9BOUssUUFBUStLLGdCQUFSLEdBQTJCOztBQUV6Qjs7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxpQkFsQnlCOztBQW9CekI7Ozs7Ozs7QUFPQSx1QkEzQnlCOztBQTZCekI7Ozs7Ozs7QUFPQSxpQkFwQ3lCOztBQXNDekI7Ozs7Ozs7Ozs7Ozs7OztBQWVBLGtCQXJEeUI7O0FBdUR6Qjs7Ozs7Ozs7OztBQVVBLGVBakV5Qjs7QUFtRXpCOzs7Ozs7Ozs7QUFTQSxxQkE1RXlCOztBQThFekI7Ozs7Ozs7OztBQVNBLGlCQXZGeUIsRUEwRnpCQyxNQTFGeUIsQ0EwRmxCdkwsU0FBU3NMLGdCQTFGUyxDQUEzQjs7QUE0RkF4TCxLQUFLMEwsU0FBTCxDQUFlbEQsS0FBZixDQUFxQi9ILE9BQXJCLEVBQThCLENBQUNBLE9BQUQsRUFBVSxTQUFWLENBQTlCO0FBQ0FQLFNBQVN5TCxVQUFULENBQW9CekksSUFBcEIsQ0FBeUJ6QyxPQUF6QjtBQUNBbUwsT0FBT0MsT0FBUCxHQUFpQnBMLE9BQWpCIiwiZmlsZSI6Im1lc3NhZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBNZXNzYWdlIENsYXNzIHJlcHJlc2VudHMgTWVzc2FnZXMgc2VudCBhbW9uZ3N0IHBhcnRpY2lwYW50c1xuICogb2Ygb2YgYSBDb252ZXJzYXRpb24uXG4gKlxuICogVGhlIHNpbXBsZXN0IHdheSB0byBjcmVhdGUgYW5kIHNlbmQgYSBtZXNzYWdlIGlzOlxuICpcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnSGVsbG8gdGhlcmUnKS5zZW5kKCk7XG4gKlxuICogRm9yIGNvbnZlcnNhdGlvbnMgdGhhdCBpbnZvbHZlIG5vdGlmaWNhdGlvbnMgKHByaW1hcmlseSBmb3IgQW5kcm9pZCBhbmQgSU9TKSwgdGhlIG1vcmUgY29tbW9uIHBhdHRlcm4gaXM6XG4gKlxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKCdIZWxsbyB0aGVyZScpLnNlbmQoe3RleHQ6IFwiTWVzc2FnZSBmcm9tIEZyZWQ6IEhlbGxvIHRoZXJlXCJ9KTtcbiAqXG4gKiBUeXBpY2FsbHksIHJlbmRlcmluZyB3b3VsZCBiZSBkb25lIGFzIGZvbGxvd3M6XG4gKlxuICogICAgICAvLyBDcmVhdGUgYSBsYXllci5RdWVyeSB0aGF0IGxvYWRzIE1lc3NhZ2VzIGZvciB0aGVcbiAqICAgICAgLy8gc3BlY2lmaWVkIENvbnZlcnNhdGlvbi5cbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAqICAgICAgICBtb2RlbDogUXVlcnkuTWVzc2FnZSxcbiAqICAgICAgICBwcmVkaWNhdGU6ICdjb252ZXJzYXRpb24gPSBcIicgKyBjb252ZXJzYXRpb24uaWQgKyAnXCInXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gQW55IHRpbWUgdGhlIFF1ZXJ5J3MgZGF0YSBjaGFuZ2VzIHRoZSAnY2hhbmdlJ1xuICogICAgICAvLyBldmVudCB3aWxsIGZpcmUuXG4gKiAgICAgIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihsYXllckV2dCkge1xuICogICAgICAgIHJlbmRlck5ld01lc3NhZ2VzKHF1ZXJ5LmRhdGEpO1xuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIFRoaXMgd2lsbCBjYWxsIHdpbGwgY2F1c2UgdGhlIGFib3ZlIGV2ZW50IGhhbmRsZXIgdG8gcmVjZWl2ZVxuICogICAgICAvLyBhIGNoYW5nZSBldmVudCwgYW5kIHdpbGwgdXBkYXRlIHF1ZXJ5LmRhdGEuXG4gKiAgICAgIGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKCdIZWxsbyB0aGVyZScpLnNlbmQoKTtcbiAqXG4gKiBUaGUgYWJvdmUgY29kZSB3aWxsIHRyaWdnZXIgdGhlIGZvbGxvd2luZyBldmVudHM6XG4gKlxuICogICogTWVzc2FnZSBJbnN0YW5jZSBmaXJlc1xuICogICAgKiBtZXNzYWdlczpzZW5kaW5nOiBBbiBldmVudCB0aGF0IGxldHMgeW91IG1vZGlmeSB0aGUgbWVzc2FnZSBwcmlvciB0byBzZW5kaW5nXG4gKiAgICAqIG1lc3NhZ2VzOnNlbnQ6IFRoZSBtZXNzYWdlIHdhcyByZWNlaXZlZCBieSB0aGUgc2VydmVyXG4gKiAgKiBRdWVyeSBJbnN0YW5jZSBmaXJlc1xuICogICAgKiBjaGFuZ2U6IFRoZSBxdWVyeSBoYXMgcmVjZWl2ZWQgYSBuZXcgTWVzc2FnZVxuICogICAgKiBjaGFuZ2U6YWRkOiBTYW1lIGFzIHRoZSBjaGFuZ2UgZXZlbnQgYnV0IGRvZXMgbm90IHJlY2VpdmUgb3RoZXIgdHlwZXMgb2YgY2hhbmdlIGV2ZW50c1xuICpcbiAqIFdoZW4gY3JlYXRpbmcgYSBNZXNzYWdlIHRoZXJlIGFyZSBhIG51bWJlciBvZiB3YXlzIHRvIHN0cnVjdHVyZSBpdC5cbiAqIEFsbCBvZiB0aGVzZSBhcmUgdmFsaWQgYW5kIGNyZWF0ZSB0aGUgc2FtZSBleGFjdCBNZXNzYWdlOlxuICpcbiAqICAgICAgLy8gRnVsbCBBUEkgc3R5bGU6XG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgcGFydHM6IFtuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe1xuICogICAgICAgICAgICAgIGJvZHk6ICdIZWxsbyB0aGVyZScsXG4gKiAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJ1xuICogICAgICAgICAgfSldXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDE6IFBhc3MgaW4gYW4gT2JqZWN0IGluc3RlYWQgb2YgYW4gYXJyYXkgb2YgbGF5ZXIuTWVzc2FnZVBhcnRzXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgcGFydHM6IHtcbiAqICAgICAgICAgICAgICBib2R5OiAnSGVsbG8gdGhlcmUnLFxuICogICAgICAgICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbidcbiAqICAgICAgICAgIH1cbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gMjogUGFzcyBpbiBhbiBhcnJheSBvZiBPYmplY3RzIGluc3RlYWQgb2YgYW4gYXJyYXkgb2YgbGF5ZXIuTWVzc2FnZVBhcnRzXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgcGFydHM6IFt7XG4gKiAgICAgICAgICAgICAgYm9keTogJ0hlbGxvIHRoZXJlJyxcbiAqICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gKiAgICAgICAgICB9XVxuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiAzOiBQYXNzIGluIGEgc3RyaW5nIChhdXRvbWF0aWNhbGx5IGFzc3VtZXMgbWltZVR5cGUgaXMgdGV4dC9wbGFpbilcbiAqICAgICAgLy8gaW5zdGVhZCBvZiBhbiBhcnJheSBvZiBvYmplY3RzLlxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAqICAgICAgICAgIHBhcnRzOiAnSGVsbG8nXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDQ6IFBhc3MgaW4gYW4gYXJyYXkgb2Ygc3RyaW5ncyAoYXV0b21hdGljYWxseSBhc3N1bWVzIG1pbWVUeXBlIGlzIHRleHQvcGxhaW4pXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgcGFydHM6IFsnSGVsbG8nXVxuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiA1OiBQYXNzIGluIGp1c3QgYSBzdHJpbmcgYW5kIG5vdGhpbmcgZWxzZVxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKCdIZWxsbycpO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDY6IFVzZSBhZGRQYXJ0LlxuICogICAgICB2YXIgbSA9IGNvbnZlcnNlYXRpb24uY3JlYXRlTWVzc2FnZSgpO1xuICogICAgICBtLmFkZFBhcnQoe2JvZHk6IFwiaGVsbG9cIiwgbWltZVR5cGU6IFwidGV4dC9wbGFpblwifSk7XG4gKlxuICogS2V5IG1ldGhvZHMsIGV2ZW50cyBhbmQgcHJvcGVydGllcyBmb3IgZ2V0dGluZyBzdGFydGVkOlxuICpcbiAqIFByb3BlcnRpZXM6XG4gKlxuICogKiBsYXllci5NZXNzYWdlLmlkOiB0aGlzIHByb3BlcnR5IGlzIHdvcnRoIGJlaW5nIGZhbWlsaWFyIHdpdGg7IGl0IGlkZW50aWZpZXMgdGhlXG4gKiAgIE1lc3NhZ2UgYW5kIGNhbiBiZSB1c2VkIGluIGBjbGllbnQuZ2V0TWVzc2FnZShpZClgIHRvIHJldHJpZXZlIGl0XG4gKiAgIGF0IGFueSB0aW1lLlxuICogKiBsYXllci5NZXNzYWdlLmludGVybmFsSWQ6IFRoaXMgcHJvcGVydHkgbWFrZXMgZm9yIGEgaGFuZHkgdW5pcXVlIElEIGZvciB1c2UgaW4gZG9tIG5vZGVzLlxuICogICBJdCBpcyBnYXVyZW50ZWVkIG5vdCB0byBjaGFuZ2UgZHVyaW5nIHRoaXMgc2Vzc2lvbi5cbiAqICogbGF5ZXIuTWVzc2FnZS5pc1JlYWQ6IEluZGljYXRlcyBpZiB0aGUgTWVzc2FnZSBoYXMgYmVlbiByZWFkIHlldDsgc2V0IGBtLmlzUmVhZCA9IHRydWVgXG4gKiAgIHRvIHRlbGwgdGhlIGNsaWVudCBhbmQgc2VydmVyIHRoYXQgdGhlIG1lc3NhZ2UgaGFzIGJlZW4gcmVhZC5cbiAqICogbGF5ZXIuTWVzc2FnZS5wYXJ0czogQW4gYXJyYXkgb2YgbGF5ZXIuTWVzc2FnZVBhcnQgY2xhc3NlcyByZXByZXNlbnRpbmcgdGhlIGNvbnRlbnRzIG9mIHRoZSBNZXNzYWdlLlxuICogKiBsYXllci5NZXNzYWdlLnNlbnRBdDogRGF0ZSB0aGUgbWVzc2FnZSB3YXMgc2VudFxuICogKiBsYXllci5NZXNzYWdlLnNlbmRlciBgdXNlcklkYDogQ29udmVyc2F0aW9uIHBhcnRpY2lwYW50IHdobyBzZW50IHRoZSBNZXNzYWdlLiBZb3UgbWF5XG4gKiAgIG5lZWQgdG8gZG8gYSBsb29rdXAgb24gdGhpcyBpZCBpbiB5b3VyIG93biBzZXJ2ZXJzIHRvIGZpbmQgYVxuICogICBkaXNwbGF5YWJsZSBuYW1lIGZvciBpdC5cbiAqXG4gKiBNZXRob2RzOlxuICpcbiAqICogbGF5ZXIuTWVzc2FnZS5zZW5kKCk6IFNlbmRzIHRoZSBtZXNzYWdlIHRvIHRoZSBzZXJ2ZXIgYW5kIHRoZSBvdGhlciBwYXJ0aWNpcGFudHMuXG4gKiAqIGxheWVyLk1lc3NhZ2Uub24oKSBhbmQgbGF5ZXIuTWVzc2FnZS5vZmYoKTsgZXZlbnQgbGlzdGVuZXJzIGJ1aWx0IG9uIHRvcCBvZiB0aGUgYGJhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lYCBucG0gcHJvamVjdFxuICpcbiAqIEV2ZW50czpcbiAqXG4gKiAqIGBtZXNzYWdlczpzZW50YDogVGhlIG1lc3NhZ2UgaGFzIGJlZW4gcmVjZWl2ZWQgYnkgdGhlIHNlcnZlci4gQ2FuIGFsc28gc3Vic2NyaWJlIHRvXG4gKiAgIHRoaXMgZXZlbnQgZnJvbSB0aGUgbGF5ZXIuQ2xpZW50IHdoaWNoIGlzIHVzdWFsbHkgc2ltcGxlci5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLk1lc3NhZ2VcbiAqIEBleHRlbmRzIGxheWVyLlN5bmNhYmxlXG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBNZXNzYWdlUGFydCA9IHJlcXVpcmUoJy4vbWVzc2FnZS1wYXJ0Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBJZGVudGl0eSA9IHJlcXVpcmUoJy4vaWRlbnRpdHknKTtcblxuY2xhc3MgTWVzc2FnZSBleHRlbmRzIFN5bmNhYmxlIHtcbiAgLyoqXG4gICAqIFNlZSBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgpXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFVubGVzcyB0aGlzIGlzIGEgc2VydmVyIHJlcHJlc2VudGF0aW9uLCB0aGlzIGlzIGEgZGV2ZWxvcGVyJ3Mgc2hvcnRoYW5kO1xuICAgIC8vIGZpbGwgaW4gdGhlIG1pc3NpbmcgcHJvcGVydGllcyBhcm91bmQgaXNSZWFkL2lzVW5yZWFkIGJlZm9yZSBpbml0aWFsaXppbmcuXG4gICAgaWYgKCFvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIGlmICgnaXNVbnJlYWQnIGluIG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucy5pc1JlYWQgPSAhb3B0aW9ucy5pc1VucmVhZCAmJiAhb3B0aW9ucy5pc191bnJlYWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLmlzUmVhZCA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMuaWQgPSBvcHRpb25zLmZyb21TZXJ2ZXIuaWQ7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuY2xpZW50KSBvcHRpb25zLmNsaWVudElkID0gb3B0aW9ucy5jbGllbnQuYXBwSWQ7XG4gICAgaWYgKCFvcHRpb25zLmNsaWVudElkKSB0aHJvdyBuZXcgRXJyb3IoJ2NsaWVudElkIHByb3BlcnR5IHJlcXVpcmVkIHRvIGNyZWF0ZSBhIE1lc3NhZ2UnKTtcbiAgICBpZiAob3B0aW9ucy5jb252ZXJzYXRpb24pIG9wdGlvbnMuY29udmVyc2F0aW9uSWQgPSBvcHRpb25zLmNvbnZlcnNhdGlvbi5pZDtcblxuICAgIC8vIEluc3VyZSBfX2FkanVzdFBhcnRzIGlzIHNldCBBRlRFUiBjbGllbnRJZCBpcyBzZXQuXG4gICAgY29uc3QgcGFydHMgPSBvcHRpb25zLnBhcnRzO1xuICAgIG9wdGlvbnMucGFydHMgPSBudWxsO1xuXG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5wYXJ0cyA9IHBhcnRzO1xuXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihvcHRpb25zLmZyb21TZXJ2ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2xpZW50KSB0aGlzLnNlbmRlciA9IGNsaWVudC51c2VyO1xuICAgICAgdGhpcy5zZW50QXQgPSBuZXcgRGF0ZSgpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5wYXJ0cykgdGhpcy5wYXJ0cyA9IFtdO1xuXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IHRydWU7XG4gICAgaWYgKCFvcHRpb25zLmZyb21TZXJ2ZXIpIHRoaXMucmVjaXBpZW50U3RhdHVzID0ge307XG4gICAgZWxzZSB0aGlzLl9fdXBkYXRlUmVjaXBpZW50U3RhdHVzKHRoaXMucmVjaXBpZW50U3RhdHVzKTtcbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5mcm9tU2VydmVyKSB7XG4gICAgICBjbGllbnQuX2FkZE1lc3NhZ2UodGhpcyk7XG4gICAgICBjb25zdCBzdGF0dXMgPSB0aGlzLnJlY2lwaWVudFN0YXR1c1tjbGllbnQudXNlci5pZF07XG4gICAgICBpZiAoc3RhdHVzICYmIHN0YXR1cyAhPT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCAmJiBzdGF0dXMgIT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLkRFTElWRVJFRCkge1xuICAgICAgICBVdGlsLmRlZmVyKCgpID0+IHRoaXMuX3NlbmRSZWNlaXB0KCdkZWxpdmVyeScpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXllci5Db252ZXJzYXRpb24gYXNzb2NpYXRlZCB3aXRoIHRoaXMgbGF5ZXIuTWVzc2FnZS5cbiAgICpcbiAgICogVXNlcyB0aGUgbGF5ZXIuTWVzc2FnZS5jb252ZXJzYXRpb25JZC5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDb252ZXJzYXRpb25cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgZ2V0Q29udmVyc2F0aW9uKGxvYWQpIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldCh0aGlzLmNsaWVudElkKS5nZXRDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCwgbG9hZCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFR1cm4gaW5wdXQgaW50byB2YWxpZCBsYXllci5NZXNzYWdlUGFydHMuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGFueSB0aW1lIHRoZSBwYXJ0c1xuICAgKiBwcm9wZXJ0eSBpcyBzZXQgKGluY2x1ZGluZyBkdXJpbmcgaW50aWFsaXphdGlvbikuICBUaGlzXG4gICAqIGlzIHdoZXJlIHdlIGNvbnZlcnQgc3RyaW5ncyBpbnRvIE1lc3NhZ2VQYXJ0cywgYW5kIGluc3RhbmNlc1xuICAgKiBpbnRvIGFycmF5cy5cbiAgICpcbiAgICogQG1ldGhvZCBfX2FkanVzdFBhcnRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge01peGVkfSBwYXJ0cyAtLSBDb3VsZCBiZSBhIHN0cmluZywgYXJyYXksIG9iamVjdCBvciBNZXNzYWdlUGFydCBpbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlUGFydFtdfVxuICAgKi9cbiAgX19hZGp1c3RQYXJ0cyhwYXJ0cykge1xuICAgIGlmICh0eXBlb2YgcGFydHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gW25ldyBNZXNzYWdlUGFydCh7XG4gICAgICAgIGJvZHk6IHBhcnRzLFxuICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5jbGllbnRJZCxcbiAgICAgIH0pXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgICByZXR1cm4gcGFydHMubWFwKHBhcnQgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICBpZiAocGFydCBpbnN0YW5jZW9mIE1lc3NhZ2VQYXJ0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gcGFydDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgTWVzc2FnZVBhcnQocGFydCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LmNsaWVudElkID0gdGhpcy5jbGllbnRJZDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAocGFydHMgJiYgdHlwZW9mIHBhcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgcGFydHMuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgICAgcmV0dXJuIFtuZXcgTWVzc2FnZVBhcnQocGFydHMpXTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBBZGQgYSBsYXllci5NZXNzYWdlUGFydCB0byB0aGlzIE1lc3NhZ2UuXG4gICAqXG4gICAqIFNob3VsZCBvbmx5IGJlIGNhbGxlZCBvbiBhbiB1bnNlbnQgTWVzc2FnZS5cbiAgICpcbiAgICogYGBgXG4gICAqIG1lc3NhZ2UuYWRkUGFydCh7bWltZVR5cGU6ICd0ZXh0L3BsYWluJywgYm9keTogJ0Zyb2RvIHJlYWxseSBpcyBhIERvZG8nfSk7XG4gICAqXG4gICAqIC8vIE9SXG4gICAqIG1lc3NhZ2UuYWRkUGFydChuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe21pbWVUeXBlOiAndGV4dC9wbGFpbicsIGJvZHk6ICdGcm9kbyByZWFsbHkgaXMgYSBEb2RvJ30pKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgYWRkUGFydFxuICAgKiBAcGFyYW0gIHtsYXllci5NZXNzYWdlUGFydC9PYmplY3R9IHBhcnQgLSBBIGxheWVyLk1lc3NhZ2VQYXJ0IGluc3RhbmNlIG9yIGEgYHttaW1lVHlwZTogJ3RleHQvcGxhaW4nLCBib2R5OiAnSGVsbG8nfWAgZm9ybWF0dGVkIE9iamVjdC5cbiAgICogQHJldHVybnMge2xheWVyLk1lc3NhZ2V9IHRoaXNcbiAgICovXG4gIGFkZFBhcnQocGFydCkge1xuICAgIGlmIChwYXJ0KSB7XG4gICAgICBwYXJ0LmNsaWVudElkID0gdGhpcy5jbGllbnRJZDtcbiAgICAgIGlmICh0eXBlb2YgcGFydCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5wYXJ0cy5wdXNoKG5ldyBNZXNzYWdlUGFydChwYXJ0KSk7XG4gICAgICB9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiBNZXNzYWdlUGFydCkge1xuICAgICAgICB0aGlzLnBhcnRzLnB1c2gocGFydCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjY2Vzc29yIGNhbGxlZCB3aGVuZXZlciB0aGUgYXBwIGFjY2Vzc2VzIGBtZXNzYWdlLnJlY2lwaWVudFN0YXR1c2AuXG4gICAqXG4gICAqIEluc3VyZXMgdGhhdCBwYXJ0aWNpcGFudHMgd2hvIGhhdmVuJ3QgeWV0IGJlZW4gc2VudCB0aGUgTWVzc2FnZSBhcmUgbWFya2VkIGFzIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlBFTkRJTkdcbiAgICpcbiAgICogQG1ldGhvZCBfX2dldFJlY2lwaWVudFN0YXR1c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcEtleSAtIFRoZSBhY3R1YWwgcHJvcGVydHkga2V5IHdoZXJlIHRoZSB2YWx1ZSBpcyBzdG9yZWRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7T2JqZWN0fVxuICAgKi9cbiAgX19nZXRSZWNpcGllbnRTdGF0dXMocEtleSkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpc1twS2V5XSB8fCB7fTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIHtcbiAgICAgIGNvbnN0IGlkID0gY2xpZW50LnVzZXIuaWQ7XG4gICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICBpZiAoY29udmVyc2F0aW9uKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiB7XG4gICAgICAgICAgaWYgKCF2YWx1ZVtwYXJ0aWNpcGFudC5pZF0pIHtcbiAgICAgICAgICAgIHZhbHVlW3BhcnRpY2lwYW50LmlkXSA9IHBhcnRpY2lwYW50LmlkID09PSBpZCA/XG4gICAgICAgICAgICAgIENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgOiBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5QRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgY2hhbmdlcyB0byB0aGUgcmVjaXBpZW50U3RhdHVzIHByb3BlcnR5LlxuICAgKlxuICAgKiBBbnkgdGltZSB0aGUgcmVjaXBpZW50U3RhdHVzIHByb3BlcnR5IGlzIHNldCxcbiAgICogUmVjYWxjdWxhdGUgYWxsIG9mIHRoZSByZWNlaXB0IHJlbGF0ZWQgcHJvcGVydGllczpcbiAgICpcbiAgICogMS4gaXNSZWFkXG4gICAqIDIuIHJlYWRTdGF0dXNcbiAgICogMy4gZGVsaXZlcnlTdGF0dXNcbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZVJlY2lwaWVudFN0YXR1c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHN0YXR1cyAtIE9iamVjdCBkZXNjcmliaW5nIHRoZSBkZWxpdmVyZWQvcmVhZC9zZW50IHZhbHVlIGZvciBlYWNoIHBhcnRpY2lwYW50XG4gICAqXG4gICAqL1xuICBfX3VwZGF0ZVJlY2lwaWVudFN0YXR1cyhzdGF0dXMsIG9sZFN0YXR1cykge1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24gfHwgVXRpbC5kb2VzT2JqZWN0TWF0Y2goc3RhdHVzLCBvbGRTdGF0dXMpKSByZXR1cm47XG5cbiAgICBjb25zdCBpZCA9IGNsaWVudC51c2VyLmlkO1xuICAgIGNvbnN0IGlzU2VuZGVyID0gdGhpcy5zZW5kZXIuc2Vzc2lvbk93bmVyO1xuICAgIGNvbnN0IHVzZXJIYXNSZWFkID0gc3RhdHVzW2lkXSA9PT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRDtcblxuICAgIHRyeSB7XG4gICAgICAvLyAtMSBzbyB3ZSBkb24ndCBjb3VudCB0aGlzIHVzZXJcbiAgICAgIGNvbnN0IHVzZXJDb3VudCA9IGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMubGVuZ3RoIC0gMTtcblxuICAgICAgLy8gSWYgc2VudCBieSB0aGlzIHVzZXIgb3IgcmVhZCBieSB0aGlzIHVzZXIsIHVwZGF0ZSBpc1JlYWQvdW5yZWFkXG4gICAgICBpZiAoIXRoaXMuX19pc1JlYWQgJiYgKGlzU2VuZGVyIHx8IHVzZXJIYXNSZWFkKSkge1xuICAgICAgICB0aGlzLl9faXNSZWFkID0gdHJ1ZTsgLy8gbm8gX191cGRhdGVJc1JlYWQgZXZlbnQgZmlyZWRcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRoZSByZWFkU3RhdHVzL2RlbGl2ZXJ5U3RhdHVzIHByb3BlcnRpZXNcbiAgICAgIGNvbnN0IHsgcmVhZENvdW50LCBkZWxpdmVyZWRDb3VudCB9ID0gdGhpcy5fZ2V0UmVjZWlwdFN0YXR1cyhzdGF0dXMsIGlkKTtcbiAgICAgIHRoaXMuX3NldFJlY2VpcHRTdGF0dXMocmVhZENvdW50LCBkZWxpdmVyZWRDb3VudCwgdXNlckNvdW50KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gRG8gbm90aGluZ1xuICAgIH1cblxuICAgIC8vIE9ubHkgdHJpZ2dlciBhbiBldmVudFxuICAgIC8vIDEuIHdlJ3JlIG5vdCBpbml0aWFsaXppbmcgYSBuZXcgTWVzc2FnZVxuICAgIC8vIDIuIHRoZSB1c2VyJ3Mgc3RhdGUgaGFzIGJlZW4gdXBkYXRlZCB0byByZWFkOyB3ZSBkb24ndCBjYXJlIGFib3V0IHVwZGF0ZXMgZnJvbSBvdGhlciB1c2VycyBpZiB3ZSBhcmVuJ3QgdGhlIHNlbmRlci5cbiAgICAvLyAgICBXZSBhbHNvIGRvbid0IGNhcmUgYWJvdXQgc3RhdGUgY2hhbmdlcyB0byBkZWxpdmVyZWQ7IHRoZXNlIGRvIG5vdCBpbmZvcm0gcmVuZGVyaW5nIGFzIHRoZSBmYWN0IHdlIGFyZSBwcm9jZXNzaW5nIGl0XG4gICAgLy8gICAgcHJvdmVzIGl0cyBkZWxpdmVyZWQuXG4gICAgLy8gMy4gVGhlIHVzZXIgaXMgdGhlIHNlbmRlcjsgaW4gdGhhdCBjYXNlIHdlIGRvIGNhcmUgYWJvdXQgcmVuZGVyaW5nIHJlY2VpcHRzIGZyb20gb3RoZXIgdXNlcnNcbiAgICBpZiAoIXRoaXMuaXNJbml0aWFsaXppbmcgJiYgb2xkU3RhdHVzKSB7XG4gICAgICBjb25zdCB1c2Vyc1N0YXRlVXBkYXRlZFRvUmVhZCA9IHVzZXJIYXNSZWFkICYmIG9sZFN0YXR1c1tpZF0gIT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQ7XG4gICAgICBpZiAodXNlcnNTdGF0ZVVwZGF0ZWRUb1JlYWQgfHwgaXNTZW5kZXIpIHtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICAgICAgb2xkVmFsdWU6IG9sZFN0YXR1cyxcbiAgICAgICAgICBuZXdWYWx1ZTogc3RhdHVzLFxuICAgICAgICAgIHByb3BlcnR5OiAncmVjaXBpZW50U3RhdHVzJyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbnVtYmVyIG9mIHBhcnRpY2lwYW50cyB3aG8gaGF2ZSByZWFkIGFuZCBiZWVuIGRlbGl2ZXJlZFxuICAgKiB0aGlzIE1lc3NhZ2VcbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0UmVjZWlwdFN0YXR1c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHN0YXR1cyAtIE9iamVjdCBkZXNjcmliaW5nIHRoZSBkZWxpdmVyZWQvcmVhZC9zZW50IHZhbHVlIGZvciBlYWNoIHBhcnRpY2lwYW50XG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWQgLSBJZGVudGl0eSBJRCBmb3IgdGhpcyB1c2VyOyBub3QgY291bnRlZCB3aGVuIHJlcG9ydGluZyBvbiBob3cgbWFueSBwZW9wbGUgaGF2ZSByZWFkL3JlY2VpdmVkLlxuICAgKiBAcmV0dXJuIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcmV0dXJuIHtudW1iZXJ9IHJlc3VsdC5yZWFkQ291bnRcbiAgICogQHJldHVybiB7bnVtYmVyfSByZXN1bHQuZGVsaXZlcmVkQ291bnRcbiAgICovXG4gIF9nZXRSZWNlaXB0U3RhdHVzKHN0YXR1cywgaWQpIHtcbiAgICBsZXQgcmVhZENvdW50ID0gMCxcbiAgICAgIGRlbGl2ZXJlZENvdW50ID0gMDtcbiAgICBPYmplY3Qua2V5cyhzdGF0dXMpXG4gICAgICAuZmlsdGVyKHBhcnRpY2lwYW50ID0+IHBhcnRpY2lwYW50ICE9PSBpZClcbiAgICAgIC5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IHtcbiAgICAgICAgaWYgKHN0YXR1c1twYXJ0aWNpcGFudF0gPT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpIHtcbiAgICAgICAgICByZWFkQ291bnQrKztcbiAgICAgICAgICBkZWxpdmVyZWRDb3VudCsrO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXR1c1twYXJ0aWNpcGFudF0gPT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLkRFTElWRVJFRCkge1xuICAgICAgICAgIGRlbGl2ZXJlZENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYWRDb3VudCxcbiAgICAgIGRlbGl2ZXJlZENvdW50LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgbGF5ZXIuTWVzc2FnZS5yZWFkU3RhdHVzIGFuZCBsYXllci5NZXNzYWdlLmRlbGl2ZXJ5U3RhdHVzIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX3NldFJlY2VpcHRTdGF0dXNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bnVtYmVyfSByZWFkQ291bnRcbiAgICogQHBhcmFtICB7bnVtYmVyfSBkZWxpdmVyZWRDb3VudFxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHVzZXJDb3VudFxuICAgKi9cbiAgX3NldFJlY2VpcHRTdGF0dXMocmVhZENvdW50LCBkZWxpdmVyZWRDb3VudCwgdXNlckNvdW50KSB7XG4gICAgaWYgKHJlYWRDb3VudCA9PT0gdXNlckNvdW50KSB7XG4gICAgICB0aGlzLnJlYWRTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLkFMTDtcbiAgICB9IGVsc2UgaWYgKHJlYWRDb3VudCA+IDApIHtcbiAgICAgIHRoaXMucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuU09NRTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWFkU3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FO1xuICAgIH1cbiAgICBpZiAoZGVsaXZlcmVkQ291bnQgPT09IHVzZXJDb3VudCkge1xuICAgICAgdGhpcy5kZWxpdmVyeVN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuQUxMO1xuICAgIH0gZWxzZSBpZiAoZGVsaXZlcmVkQ291bnQgPiAwKSB7XG4gICAgICB0aGlzLmRlbGl2ZXJ5U3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5TT01FO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbGl2ZXJ5U3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgY2hhbmdlcyB0byB0aGUgaXNSZWFkIHByb3BlcnR5LlxuICAgKlxuICAgKiBJZiBzb21lb25lIGNhbGxlZCBtLmlzUmVhZCA9IHRydWUsIEFORFxuICAgKiBpZiBpdCB3YXMgcHJldmlvdXNseSBmYWxzZSwgQU5EXG4gICAqIGlmIHRoZSBjYWxsIGRpZG4ndCBjb21lIGZyb20gbGF5ZXIuTWVzc2FnZS5fX3VwZGF0ZVJlY2lwaWVudFN0YXR1cyxcbiAgICogVGhlbiBub3RpZnkgdGhlIHNlcnZlciB0aGF0IHRoZSBtZXNzYWdlIGhhcyBiZWVuIHJlYWQuXG4gICAqXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVJc1JlYWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gdmFsdWUgLSBUcnVlIGlmIGlzUmVhZCBpcyB0cnVlLlxuICAgKi9cbiAgX191cGRhdGVJc1JlYWQodmFsdWUpIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIpIHtcbiAgICAgICAgdGhpcy5fc2VuZFJlY2VpcHQoQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCk7XG4gICAgICB9XG4gICAgICB0aGlzLl90cmlnZ2VyTWVzc2FnZVJlYWQoKTtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb24pIGNvbnZlcnNhdGlvbi51bnJlYWRDb3VudC0tO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIGV2ZW50cyBpbmRpY2F0aW5nIGNoYW5nZXMgdG8gdGhlIGlzUmVhZC9pc1VucmVhZCBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF90cmlnZ2VyTWVzc2FnZVJlYWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF90cmlnZ2VyTWVzc2FnZVJlYWQoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmlzUmVhZDtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnaXNSZWFkJyxcbiAgICAgIG9sZFZhbHVlOiAhdmFsdWUsXG4gICAgICBuZXdWYWx1ZTogdmFsdWUsXG4gICAgfSk7XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICBwcm9wZXJ0eTogJ2lzVW5yZWFkJyxcbiAgICAgIG9sZFZhbHVlOiB2YWx1ZSxcbiAgICAgIG5ld1ZhbHVlOiAhdmFsdWUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIFJlYWQgb3IgRGVsaXZlcnkgUmVjZWlwdCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBGb3IgUmVhZCBSZWNlaXB0LCB5b3UgY2FuIGFsc28ganVzdCB3cml0ZTpcbiAgICpcbiAgICogYGBgXG4gICAqIG1lc3NhZ2UuaXNSZWFkID0gdHJ1ZTtcbiAgICogYGBgXG4gICAqXG4gICAqIFlvdSBjYW4gcmV0cmFjdCBhIERlbGl2ZXJ5IG9yIFJlYWQgUmVjZWlwdDsgb25jZSBtYXJrZWQgYXMgRGVsaXZlcmVkIG9yIFJlYWQsIGl0IGNhbid0IGdvIGJhY2suXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzc2FnZS5zZW5kUmVjZWlwdChsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFJlY2VpcHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IFt0eXBlPWxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQURdIC0gT25lIG9mIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgb3IgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUllcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgc2VuZFJlY2VpcHQodHlwZSA9IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpIHtcbiAgICBpZiAodHlwZSA9PT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCkge1xuICAgICAgaWYgKHRoaXMuaXNSZWFkKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2l0aG91dCB0cmlnZ2VyaW5nIHRoZSBldmVudCwgY2xlYXJPYmplY3QgaXNuJ3QgY2FsbGVkLFxuICAgICAgICAvLyB3aGljaCBtZWFucyB0aG9zZSB1c2luZyB0aGUgdG9PYmplY3QoKSBkYXRhIHdpbGwgaGF2ZSBhbiBpc1JlYWQgdGhhdCBkb2Vzbid0IG1hdGNoXG4gICAgICAgIC8vIHRoaXMgaW5zdGFuY2UuICBXaGljaCB0eXBpY2FsbHkgbGVhZHMgdG8gbG90cyBvZiBleHRyYSBhdHRlbXB0c1xuICAgICAgICAvLyB0byBtYXJrIHRoZSBtZXNzYWdlIGFzIHJlYWQuXG4gICAgICAgIHRoaXMuX19pc1JlYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl90cmlnZ2VyTWVzc2FnZVJlYWQoKTtcbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uKSBjb252ZXJzYXRpb24udW5yZWFkQ291bnQtLTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fc2VuZFJlY2VpcHQodHlwZSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIFJlYWQgb3IgRGVsaXZlcnkgUmVjZWlwdCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBUaGlzIGJ5cGFzc2VzIGFueSB2YWxpZGF0aW9uIGFuZCBnb2VzIGRpcmVjdCB0byBzZW5kaW5nIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5PVEU6IFNlcnZlciBlcnJvcnMgYXJlIG5vdCBoYW5kbGVkOyB0aGUgbG9jYWwgcmVjZWlwdCBzdGF0ZSBpcyBzdWl0YWJsZSBldmVuXG4gICAqIGlmIG91dCBvZiBzeW5jIHdpdGggdGhlIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZFJlY2VpcHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IFt0eXBlPXJlYWRdIC0gT25lIG9mIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgb3IgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUllcbiAgICovXG4gIF9zZW5kUmVjZWlwdCh0eXBlKSB7XG4gICAgLy8gVGhpcyBsaXR0bGUgdGVzdCBleGlzdHMgc28gdGhhdCB3ZSBkb24ndCBzZW5kIHJlY2VpcHRzIG9uIENvbnZlcnNhdGlvbnMgd2UgYXJlIG5vIGxvbmdlclxuICAgIC8vIHBhcnRpY2lwYW50cyBpbiAocGFydGljaXBhbnRzID0gW10gaWYgd2UgYXJlIG5vdCBhIHBhcnRpY2lwYW50KVxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICBpZiAoY29udmVyc2F0aW9uICYmIGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJy9yZWNlaXB0cycsXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdHlwZSxcbiAgICAgIH0sXG4gICAgICBzeW5jOiB7XG4gICAgICAgIC8vIFRoaXMgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIGEgUE9TVC9DUkVBVEUgcmVxdWVzdCBvbiB0aGUgTWVzc2FnZVxuICAgICAgICBvcGVyYXRpb246ICdSRUNFSVBUJyxcbiAgICAgIH0sXG4gICAgfSwgKCkgPT4gdGhpcy5fc2V0U3luY2VkKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgdGhlIG1lc3NhZ2UgdG8gYWxsIHBhcnRpY2lwYW50cyBvZiB0aGUgQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBNZXNzYWdlIG11c3QgaGF2ZSBwYXJ0cyBhbmQgYSB2YWxpZCBjb252ZXJzYXRpb24gdG8gc2VuZCBzdWNjZXNzZnVsbHkuXG4gICAqXG4gICAqIFRoZSBzZW5kIG1ldGhvZCB0YWtlcyBhIGBub3RpZmljYXRpb25gIG9iamVjdC4gSW4gbm9ybWFsIHVzZSwgaXQgcHJvdmlkZXMgdGhlIHNhbWUgbm90aWZpY2F0aW9uIHRvIEFMTFxuICAgKiByZWNpcGllbnRzLCBidXQgeW91IGNhbiBjdXN0b21pemUgbm90aWZpY2F0aW9ucyBvbiBhIHBlciByZWNpcGllbnQgYmFzaXMsIGFzIHdlbGwgYXMgZW1iZWQgYWN0aW9ucyBpbnRvIHRoZSBub3RpZmljYXRpb24uXG4gICAqIEZvciB0aGUgRnVsbCBBUEksIHNlZSBodHRwczovL2RldmVsb3Blci5sYXllci5jb20vZG9jcy9wbGF0Zm9ybS9tZXNzYWdlcyNub3RpZmljYXRpb24tY3VzdG9taXphdGlvbi5cbiAgICpcbiAgICogRm9yIHRoZSBGdWxsIEFQSSwgc2VlIFtTZXJ2ZXIgRG9jc10oaHR0cHM6Ly9kZXZlbG9wZXIubGF5ZXIuY29tL2RvY3MvcGxhdGZvcm0vbWVzc2FnZXMjbm90aWZpY2F0aW9uLWN1c3RvbWl6YXRpb24pLlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZS5zZW5kKHtcbiAgICogICAgdGl0bGU6IFwiTmV3IEhvYmJpdCBNZXNzYWdlXCIsXG4gICAqICAgIHRleHQ6IFwiRnJvZG8tdGhlLURvZG86IEhlbGxvIFNhbSwgd2hhdCBzYXkgd2Ugd2FsdHogaW50byBNb3Jkb3IgbGlrZSB3ZSBvd24gdGhlIHBsYWNlP1wiLFxuICAgKiAgICBzb3VuZDogXCJ3aGlueWhvYmJpdC5haWZmXCJcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtub3RpZmljYXRpb25dIC0gUGFyYW1ldGVycyBmb3IgY29udHJvbGluZyBob3cgdGhlIHBob25lcyBtYW5hZ2Ugbm90aWZpY2F0aW9ucyBvZiB0aGUgbmV3IE1lc3NhZ2UuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICBTZWUgSU9TIGFuZCBBbmRyb2lkIGRvY3MgZm9yIGRldGFpbHMuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbbm90aWZpY2F0aW9uLnRpdGxlXSAtIFRpdGxlIHRvIHNob3cgb24gbG9jayBzY3JlZW4gYW5kIG5vdGlmaWNhdGlvbiBiYXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtub3RpZmljYXRpb24udGV4dF0gLSBUZXh0IG9mIHlvdXIgbm90aWZpY2F0aW9uXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbbm90aWZpY2F0aW9uLnNvdW5kXSAtIE5hbWUgb2YgYW4gYXVkaW8gZmlsZSBvciBvdGhlciBzb3VuZC1yZWxhdGVkIGhpbnRcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgc2VuZChub3RpZmljYXRpb24pIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKHRydWUpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY29udmVyc2F0aW9uTWlzc2luZyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc3luY1N0YXRlICE9PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuYWxyZWFkeVNlbnQpO1xuICAgIH1cblxuXG4gICAgaWYgKGNvbnZlcnNhdGlvbi5pc0xvYWRpbmcpIHtcbiAgICAgIGNvbnZlcnNhdGlvbi5vbmNlKCdjb252ZXJzYXRpb25zOmxvYWRlZCcsICgpID0+IHRoaXMuc2VuZChub3RpZmljYXRpb24pKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5wYXJ0cyB8fCAhdGhpcy5wYXJ0cy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkucGFydHNNaXNzaW5nKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGNyZWF0ZWQgb24gdGhlIHNlcnZlclxuICAgIC8vIGFuZCB1cGRhdGUgdGhlIGxhc3RNZXNzYWdlIHByb3BlcnR5XG4gICAgY29udmVyc2F0aW9uLnNlbmQodGhpcyk7XG5cbiAgICAvLyBJZiB3ZSBhcmUgc2VuZGluZyBhbnkgRmlsZS9CbG9iIG9iamVjdHMsIGFuZCB0aGVpciBNaW1lIFR5cGVzIG1hdGNoIG91ciB0ZXN0LFxuICAgIC8vIHdhaXQgdW50aWwgdGhlIGJvZHkgaXMgdXBkYXRlZCB0byBiZSBhIHN0cmluZyByYXRoZXIgdGhhbiBGaWxlIGJlZm9yZSBjYWxsaW5nIF9hZGRNZXNzYWdlXG4gICAgLy8gd2hpY2ggd2lsbCBhZGQgaXQgdG8gdGhlIFF1ZXJ5IFJlc3VsdHMgYW5kIHBhc3MgdGhpcyBvbiB0byBhIHJlbmRlcmVyIHRoYXQgZXhwZWN0cyBcInRleHQvcGxhaW5cIiB0byBiZSBhIHN0cmluZ1xuICAgIC8vIHJhdGhlciB0aGFuIGEgYmxvYi5cbiAgICB0aGlzLl9yZWFkQWxsQmxvYnMoKCkgPT4ge1xuICAgICAgLy8gQ2FsbGluZyB0aGlzIHdpbGwgYWRkIHRoaXMgdG8gYW55IGxpc3RlbmluZyBRdWVyaWVzLi4uIHNvIHBvc2l0aW9uIG5lZWRzIHRvIGhhdmUgYmVlbiBzZXQgZmlyc3Q7XG4gICAgICAvLyBoYW5kbGVkIGluIGNvbnZlcnNhdGlvbi5zZW5kKHRoaXMpXG4gICAgICBjbGllbnQuX2FkZE1lc3NhZ2UodGhpcyk7XG5cbiAgICAgIC8vIGFsbG93IGZvciBtb2RpZmljYXRpb24gb2YgbWVzc2FnZSBiZWZvcmUgc2VuZGluZ1xuICAgICAgdGhpcy50cmlnZ2VyKCdtZXNzYWdlczpzZW5kaW5nJyk7XG5cbiAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHBhcnRzOiBuZXcgQXJyYXkodGhpcy5wYXJ0cy5sZW5ndGgpLFxuICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgIH07XG4gICAgICBpZiAobm90aWZpY2F0aW9uKSBkYXRhLm5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbjtcblxuICAgICAgdGhpcy5fcHJlcGFyZVBhcnRzRm9yU2VuZGluZyhkYXRhKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBbnkgTWVzc2FnZVBhcnQgdGhhdCBjb250YWlucyBhIHRleHR1YWwgYmxvYiBzaG91bGQgY29udGFpbiBhIHN0cmluZyBiZWZvcmUgd2Ugc2VuZC5cbiAgICpcbiAgICogSWYgYSBNZXNzYWdlUGFydCB3aXRoIGEgQmxvYiBvciBGaWxlIGFzIGl0cyBib2R5IHdlcmUgdG8gYmUgYWRkZWQgdG8gdGhlIENsaWVudCxcbiAgICogVGhlIFF1ZXJ5IHdvdWxkIHJlY2VpdmUgdGhpcywgZGVsaXZlciBpdCB0byBhcHBzIGFuZCB0aGUgYXBwIHdvdWxkIGNyYXNoLlxuICAgKiBNb3N0IHJlbmRlcmluZyBjb2RlIGV4cGVjdGluZyB0ZXh0L3BsYWluIHdvdWxkIGV4cGVjdCBhIHN0cmluZyBub3QgYSBGaWxlLlxuICAgKlxuICAgKiBXaGVuIHRoaXMgdXNlciBpcyBzZW5kaW5nIGEgZmlsZSwgYW5kIHRoYXQgZmlsZSBpcyB0ZXh0dWFsLCBtYWtlIHN1cmVcbiAgICogaXRzIGFjdHVhbCB0ZXh0IGRlbGl2ZXJlZCB0byB0aGUgVUkuXG4gICAqXG4gICAqIEBtZXRob2QgX3JlYWRBbGxCbG9ic1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3JlYWRBbGxCbG9icyhjYWxsYmFjaykge1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgY29uc3QgcGFydHMgPSB0aGlzLnBhcnRzLmZpbHRlcihwYXJ0ID0+IFV0aWwuaXNCbG9iKHBhcnQuYm9keSkgJiYgcGFydC5pc1RleHR1YWxNaW1lVHlwZSgpKTtcbiAgICBwYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICBVdGlsLmZldGNoVGV4dEZyb21GaWxlKHBhcnQuYm9keSwgKHRleHQpID0+IHtcbiAgICAgICAgcGFydC5ib2R5ID0gdGV4dDtcbiAgICAgICAgY291bnQrKztcbiAgICAgICAgaWYgKGNvdW50ID09PSBwYXJ0cy5sZW5ndGgpIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoIXBhcnRzLmxlbmd0aCkgY2FsbGJhY2soKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnN1cmVzIHRoYXQgZWFjaCBwYXJ0IGlzIHJlYWR5IHRvIHNlbmQgYmVmb3JlIGFjdHVhbGx5IHNlbmRpbmcgdGhlIE1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3ByZXBhcmVQYXJ0c0ZvclNlbmRpbmdcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBzdHJ1Y3R1cmUgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyXG4gICAqL1xuICBfcHJlcGFyZVBhcnRzRm9yU2VuZGluZyhkYXRhKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBsZXQgY291bnQgPSAwO1xuICAgIHRoaXMucGFydHMuZm9yRWFjaCgocGFydCwgaW5kZXgpID0+IHtcbiAgICAgIHBhcnQub25jZSgncGFydHM6c2VuZCcsIGV2dCA9PiB7XG4gICAgICAgIGRhdGEucGFydHNbaW5kZXhdID0ge1xuICAgICAgICAgIG1pbWVfdHlwZTogZXZ0Lm1pbWVfdHlwZSxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGV2dC5jb250ZW50KSBkYXRhLnBhcnRzW2luZGV4XS5jb250ZW50ID0gZXZ0LmNvbnRlbnQ7XG4gICAgICAgIGlmIChldnQuYm9keSkgZGF0YS5wYXJ0c1tpbmRleF0uYm9keSA9IGV2dC5ib2R5O1xuICAgICAgICBpZiAoZXZ0LmVuY29kaW5nKSBkYXRhLnBhcnRzW2luZGV4XS5lbmNvZGluZyA9IGV2dC5lbmNvZGluZztcblxuICAgICAgICBjb3VudCsrO1xuICAgICAgICBpZiAoY291bnQgPT09IHRoaXMucGFydHMubGVuZ3RoKSB7XG4gICAgICAgICAgdGhpcy5fc2VuZChkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSwgdGhpcyk7XG4gICAgICBwYXJ0Ll9zZW5kKGNsaWVudCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIHRoZSBhY3R1YWwgc2VuZGluZy5cbiAgICpcbiAgICogbGF5ZXIuTWVzc2FnZS5zZW5kIGhhcyBzb21lIHBvdGVudGlhbGx5IGFzeW5jaHJvbm91c1xuICAgKiBwcmVwcm9jZXNzaW5nIHRvIGRvIGJlZm9yZSBzZW5kaW5nIChSaWNoIENvbnRlbnQpOyBhY3R1YWwgc2VuZGluZ1xuICAgKiBpcyBkb25lIGhlcmUuXG4gICAqXG4gICAqIEBtZXRob2QgX3NlbmRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zZW5kKGRhdGEpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcblxuICAgIHRoaXMuc2VudEF0ID0gbmV3IERhdGUoKTtcbiAgICBjbGllbnQuc2VuZFNvY2tldFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiB7XG4gICAgICAgIG1ldGhvZDogJ01lc3NhZ2UuY3JlYXRlJyxcbiAgICAgICAgb2JqZWN0X2lkOiBjb252ZXJzYXRpb24uaWQsXG4gICAgICAgIGRhdGEsXG4gICAgICB9LFxuICAgICAgc3luYzoge1xuICAgICAgICBkZXBlbmRzOiBbdGhpcy5jb252ZXJzYXRpb25JZCwgdGhpcy5pZF0sXG4gICAgICAgIHRhcmdldDogdGhpcy5pZCxcbiAgICAgIH0sXG4gICAgfSwgKHN1Y2Nlc3MsIHNvY2tldERhdGEpID0+IHRoaXMuX3NlbmRSZXN1bHQoc3VjY2Vzcywgc29ja2V0RGF0YSkpO1xuICB9XG5cbiAgX2dldFNlbmREYXRhKGRhdGEpIHtcbiAgICBkYXRhLm9iamVjdF9pZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cblxuICAvKipcbiAgICAqIGxheWVyLk1lc3NhZ2Uuc2VuZCgpIFN1Y2Nlc3MgQ2FsbGJhY2suXG4gICAgKlxuICAgICogSWYgc3VjY2Vzc2Z1bGx5IHNlbmRpbmcgdGhlIG1lc3NhZ2U7IHRyaWdnZXJzIGEgJ3NlbnQnIGV2ZW50LFxuICAgICogYW5kIHVwZGF0ZXMgdGhlIG1lc3NhZ2UuaWQvdXJsXG4gICAgKlxuICAgICogQG1ldGhvZCBfc2VuZFJlc3VsdFxuICAgICogQHByaXZhdGVcbiAgICAqIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlRGF0YSAtIFNlcnZlciBkZXNjcmlwdGlvbiBvZiB0aGUgbWVzc2FnZVxuICAgICovXG4gIF9zZW5kUmVzdWx0KHsgc3VjY2VzcywgZGF0YSB9KSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIoZGF0YSk7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOnNlbnQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50cmlnZ2VyKCdtZXNzYWdlczpzZW50LWVycm9yJywgeyBlcnJvcjogZGF0YSB9KTtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcbiAgfVxuXG4gIC8qIE5PVCBGT1IgSlNEVUNLXG4gICAqIFN0YW5kYXJkIGBvbigpYCBwcm92aWRlZCBieSBsYXllci5Sb290LlxuICAgKlxuICAgKiBBZGRzIHNvbWUgc3BlY2lhbCBoYW5kbGluZyBvZiAnbWVzc2FnZXM6bG9hZGVkJyBzbyB0aGF0IGNhbGxzIHN1Y2ggYXNcbiAgICpcbiAgICogICAgICB2YXIgbSA9IGNsaWVudC5nZXRNZXNzYWdlKCdsYXllcjovLy9tZXNzYWdlcy8xMjMnLCB0cnVlKVxuICAgKiAgICAgIC5vbignbWVzc2FnZXM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIG15cmVyZW5kZXIobSk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgbXlyZW5kZXIobSk7IC8vIHJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBtIHVudGlsIHRoZSBkZXRhaWxzIG9mIG0gaGF2ZSBsb2FkZWRcbiAgICpcbiAgICogY2FuIGZpcmUgdGhlaXIgY2FsbGJhY2sgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBjbGllbnQgbG9hZHMgb3IgaGFzXG4gICAqIGFscmVhZHkgbG9hZGVkIHRoZSBNZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIG9uXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZlbnROYW1lXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBldmVudEhhbmRsZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250ZXh0XG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgY29uc3QgaGFzTG9hZGVkRXZ0ID0gbmFtZSA9PT0gJ21lc3NhZ2VzOmxvYWRlZCcgfHxcbiAgICAgIG5hbWUgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmIG5hbWVbJ21lc3NhZ2VzOmxvYWRlZCddO1xuXG4gICAgaWYgKGhhc0xvYWRlZEV2dCAmJiAhdGhpcy5pc0xvYWRpbmcpIHtcbiAgICAgIGNvbnN0IGNhbGxOb3cgPSBuYW1lID09PSAnbWVzc2FnZXM6bG9hZGVkJyA/IGNhbGxiYWNrIDogbmFtZVsnbWVzc2FnZXM6bG9hZGVkJ107XG4gICAgICBVdGlsLmRlZmVyKCgpID0+IGNhbGxOb3cuYXBwbHkoY29udGV4dCkpO1xuICAgIH1cbiAgICBzdXBlci5vbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBNZXNzYWdlIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogVGhpcyBjYWxsIHdpbGwgc3VwcG9ydCB2YXJpb3VzIGRlbGV0aW9uIG1vZGVzLiAgQ2FsbGluZyB3aXRob3V0IGEgZGVsZXRpb24gbW9kZSBpcyBkZXByZWNhdGVkLlxuICAgKlxuICAgKiBEZWxldGlvbiBNb2RlczpcbiAgICpcbiAgICogKiBsYXllci5Db25zdGFudHMuREVMRVRJT05fTU9ERS5BTEw6IFRoaXMgZGVsZXRlcyB0aGUgbG9jYWwgY29weSBpbW1lZGlhdGVseSwgYW5kIGF0dGVtcHRzIHRvIGFsc29cbiAgICogICBkZWxldGUgdGhlIHNlcnZlcidzIGNvcHkuXG4gICAqICogbGF5ZXIuQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzogRGVsZXRlcyB0aGlzIE1lc3NhZ2UgZnJvbSBhbGwgb2YgbXkgZGV2aWNlczsgbm8gZWZmZWN0IG9uIG90aGVyIHVzZXJzLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gZGVsZXRpb25Nb2RlXG4gICAqL1xuICBkZWxldGUobW9kZSkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcblxuICAgIGxldCBxdWVyeVN0cjtcbiAgICBzd2l0Y2ggKG1vZGUpIHtcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuQUxMOlxuICAgICAgY2FzZSB0cnVlOlxuICAgICAgICBxdWVyeVN0ciA9ICdtb2RlPWFsbF9wYXJ0aWNpcGFudHMnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzpcbiAgICAgICAgcXVlcnlTdHIgPSAnbW9kZT1teV9kZXZpY2VzJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmRlbGV0aW9uTW9kZVVuc3VwcG9ydGVkKTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IHRoaXMuaWQ7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnPycgKyBxdWVyeVN0cixcbiAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgfSwgcmVzdWx0ID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgKCFyZXN1bHQuZGF0YSB8fCByZXN1bHQuZGF0YS5pZCAhPT0gJ25vdF9mb3VuZCcpKSBNZXNzYWdlLmxvYWQoaWQsIGNsaWVudCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl9kZWxldGVkKCk7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoaXMgTWVzc2FnZSBmcm9tIHRoZSBzeXN0ZW0uXG4gICAqXG4gICAqIFRoaXMgd2lsbCBkZXJlZ2lzdGVyIHRoZSBNZXNzYWdlLCByZW1vdmUgYWxsIGV2ZW50c1xuICAgKiBhbmQgYWxsb3cgZ2FyYmFnZSBjb2xsZWN0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlc3Ryb3lcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBpZiAoY2xpZW50KSBjbGllbnQuX3JlbW92ZU1lc3NhZ2UodGhpcyk7XG4gICAgdGhpcy5wYXJ0cy5mb3JFYWNoKHBhcnQgPT4gcGFydC5kZXN0cm95KCkpO1xuICAgIHRoaXMuX19wYXJ0cyA9IG51bGw7XG5cbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoaXMgaW5zdGFuY2Ugd2l0aCB0aGUgZGVzY3JpcHRpb24gZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYW4gYmUgdXNlZCBmb3IgY3JlYXRpbmcgb3IgZm9yIHVwZGF0aW5nIHRoZSBpbnN0YW5jZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcG9wdWxhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtIC0gU2VydmVyIGRlc2NyaXB0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAqL1xuICBfcG9wdWxhdGVGcm9tU2VydmVyKG1lc3NhZ2UpIHtcbiAgICB0aGlzLl9pblBvcHVsYXRlRnJvbVNlcnZlciA9IHRydWU7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIHRoaXMuaWQgPSBtZXNzYWdlLmlkO1xuICAgIHRoaXMudXJsID0gbWVzc2FnZS51cmw7XG4gICAgY29uc3Qgb2xkUG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uO1xuICAgIHRoaXMucG9zaXRpb24gPSBtZXNzYWdlLnBvc2l0aW9uO1xuXG5cbiAgICAvLyBBc3NpZ24gSURzIHRvIHByZWV4aXN0aW5nIFBhcnRzIHNvIHRoYXQgd2UgY2FuIGNhbGwgZ2V0UGFydEJ5SWQoKVxuICAgIGlmICh0aGlzLnBhcnRzKSB7XG4gICAgICB0aGlzLnBhcnRzLmZvckVhY2goKHBhcnQsIGluZGV4KSA9PiB7XG4gICAgICAgIGlmICghcGFydC5pZCkgcGFydC5pZCA9IGAke3RoaXMuaWR9L3BhcnRzLyR7aW5kZXh9YDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMucGFydHMgPSBtZXNzYWdlLnBhcnRzLm1hcChwYXJ0ID0+IHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nUGFydCA9IHRoaXMuZ2V0UGFydEJ5SWQocGFydC5pZCk7XG4gICAgICBpZiAoZXhpc3RpbmdQYXJ0KSB7XG4gICAgICAgIGV4aXN0aW5nUGFydC5fcG9wdWxhdGVGcm9tU2VydmVyKHBhcnQpO1xuICAgICAgICByZXR1cm4gZXhpc3RpbmdQYXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIE1lc3NhZ2VQYXJ0Ll9jcmVhdGVGcm9tU2VydmVyKHBhcnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWNpcGllbnRTdGF0dXMgPSBtZXNzYWdlLnJlY2lwaWVudF9zdGF0dXMgfHwge307XG5cbiAgICB0aGlzLmlzUmVhZCA9ICFtZXNzYWdlLmlzX3VucmVhZDtcblxuICAgIHRoaXMuc2VudEF0ID0gbmV3IERhdGUobWVzc2FnZS5zZW50X2F0KTtcbiAgICB0aGlzLnJlY2VpdmVkQXQgPSBtZXNzYWdlLnJlY2VpdmVkX2F0ID8gbmV3IERhdGUobWVzc2FnZS5yZWNlaXZlZF9hdCkgOiB1bmRlZmluZWQ7XG5cbiAgICBsZXQgc2VuZGVyO1xuICAgIGlmIChtZXNzYWdlLnNlbmRlci5pZCkge1xuICAgICAgc2VuZGVyID0gY2xpZW50LmdldElkZW50aXR5KG1lc3NhZ2Uuc2VuZGVyLmlkKTtcbiAgICB9XG5cbiAgICAvLyBCZWNhdXNlIHRoZXJlIG1heSBiZSBubyBJRCwgd2UgaGF2ZSB0byBieXBhc3MgY2xpZW50Ll9jcmVhdGVPYmplY3QgYW5kIGl0cyBzd2l0Y2ggc3RhdGVtZW50LlxuICAgIGlmICghc2VuZGVyKSB7XG4gICAgICBzZW5kZXIgPSBJZGVudGl0eS5fY3JlYXRlRnJvbVNlcnZlcihtZXNzYWdlLnNlbmRlciwgY2xpZW50KTtcbiAgICB9XG4gICAgdGhpcy5zZW5kZXIgPSBzZW5kZXI7XG5cblxuICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuXG4gICAgaWYgKG9sZFBvc2l0aW9uICYmIG9sZFBvc2l0aW9uICE9PSB0aGlzLnBvc2l0aW9uKSB7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgICAgb2xkVmFsdWU6IG9sZFBvc2l0aW9uLFxuICAgICAgICBuZXdWYWx1ZTogdGhpcy5wb3NpdGlvbixcbiAgICAgICAgcHJvcGVydHk6ICdwb3NpdGlvbicsXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBNZXNzYWdlJ3MgbGF5ZXIuTWVzc2FnZVBhcnQgd2l0aCB0aGUgc3BlY2lmaWVkIHRoZSBwYXJ0IElELlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIHBhcnQgPSBjbGllbnQuZ2V0TWVzc2FnZVBhcnQoJ2xheWVyOi8vL21lc3NhZ2VzLzZmMDhhY2ZhLTMyNjgtNGFlNS04M2Q5LTZjYTAwMDAwMDAwL3BhcnRzLzAnKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0UGFydEJ5SWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhcnRJZFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlUGFydH1cbiAgICovXG4gIGdldFBhcnRCeUlkKHBhcnRJZCkge1xuICAgIGNvbnN0IHBhcnQgPSB0aGlzLnBhcnRzID8gdGhpcy5wYXJ0cy5maWx0ZXIoYVBhcnQgPT4gYVBhcnQuaWQgPT09IHBhcnRJZClbMF0gOiBudWxsO1xuICAgIHJldHVybiBwYXJ0IHx8IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQWNjZXB0cyBqc29uLXBhdGNoIG9wZXJhdGlvbnMgZm9yIG1vZGlmeWluZyByZWNpcGllbnRTdGF0dXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVBhdGNoRXZlbnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0W119IGRhdGEgLSBBcnJheSBvZiBvcGVyYXRpb25zXG4gICAqL1xuICBfaGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSB7XG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IGZhbHNlO1xuICAgIGlmIChwYXRoc1swXS5pbmRleE9mKCdyZWNpcGllbnRfc3RhdHVzJykgPT09IDApIHtcbiAgICAgIHRoaXMuX191cGRhdGVSZWNpcGllbnRTdGF0dXModGhpcy5yZWNpcGllbnRTdGF0dXMsIG9sZFZhbHVlKTtcbiAgICB9XG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhYnNvbHV0ZSBVUkwgZm9yIHRoaXMgcmVzb3VyY2UuXG4gICAqIFVzZWQgYnkgc3luYyBtYW5hZ2VyIGJlY2F1c2UgdGhlIHVybCBtYXkgbm90IGJlIGtub3duXG4gICAqIGF0IHRoZSB0aW1lIHRoZSBzeW5jIHJlcXVlc3QgaXMgZW5xdWV1ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFVybFxuICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIC0gcmVsYXRpdmUgdXJsIGFuZCBxdWVyeSBzdHJpbmcgcGFyYW1ldGVyc1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGZ1bGwgdXJsXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0VXJsKHVybCkge1xuICAgIHJldHVybiB0aGlzLnVybCArICh1cmwgfHwgJycpO1xuICB9XG5cbiAgX3NldHVwU3luY09iamVjdChzeW5jKSB7XG4gICAgaWYgKHN5bmMgIT09IGZhbHNlKSB7XG4gICAgICBzeW5jID0gc3VwZXIuX3NldHVwU3luY09iamVjdChzeW5jKTtcbiAgICAgIGlmICghc3luYy5kZXBlbmRzKSB7XG4gICAgICAgIHN5bmMuZGVwZW5kcyA9IFt0aGlzLmNvbnZlcnNhdGlvbklkXTtcbiAgICAgIH0gZWxzZSBpZiAoc3luYy5kZXBlbmRzLmluZGV4T2YodGhpcy5pZCkgPT09IC0xKSB7XG4gICAgICAgIHN5bmMuZGVwZW5kcy5wdXNoKHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3luYztcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEdldCBhbGwgdGV4dCBwYXJ0cyBvZiB0aGUgTWVzc2FnZS5cbiAgICpcbiAgICogVXRpbGl0eSBtZXRob2QgZm9yIGV4dHJhY3RpbmcgYWxsIG9mIHRoZSB0ZXh0L3BsYWluIHBhcnRzXG4gICAqIGFuZCBjb25jYXRlbmF0aW5nIGFsbCBvZiB0aGVpciBib2R5cyB0b2dldGhlciBpbnRvIGEgc2luZ2xlIHN0cmluZy5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRUZXh0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbam9pblN0cj0nLiAgJ10gSWYgbXVsdGlwbGUgbWVzc2FnZSBwYXJ0cyBvZiB0eXBlIHRleHQvcGxhaW4sIGhvdyBkbyB5b3Ugd2FudCB0aGVtIGpvaW5lZCB0b2dldGhlcj9cbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgZ2V0VGV4dChqb2luU3RyID0gJy4gJykge1xuICAgIGxldCB0ZXh0QXJyYXkgPSB0aGlzLnBhcnRzXG4gICAgICAuZmlsdGVyKHBhcnQgPT4gcGFydC5taW1lVHlwZSA9PT0gJ3RleHQvcGxhaW4nKVxuICAgICAgLm1hcChwYXJ0ID0+IHBhcnQuYm9keSk7XG4gICAgdGV4dEFycmF5ID0gdGV4dEFycmF5LmZpbHRlcihkYXRhID0+IGRhdGEpO1xuICAgIHJldHVybiB0ZXh0QXJyYXkuam9pbihqb2luU3RyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcGxhaW4gb2JqZWN0LlxuICAgKlxuICAgKiBPYmplY3Qgd2lsbCBoYXZlIGFsbCB0aGUgc2FtZSBwdWJsaWMgcHJvcGVydGllcyBhcyB0aGlzXG4gICAqIE1lc3NhZ2UgaW5zdGFuY2UuICBOZXcgb2JqZWN0IGlzIHJldHVybmVkIGFueSB0aW1lXG4gICAqIGFueSBvZiB0aGlzIG9iamVjdCdzIHByb3BlcnRpZXMgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gUE9KTyB2ZXJzaW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgKi9cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QucmVjaXBpZW50U3RhdHVzID0gVXRpbC5jbG9uZSh0aGlzLnJlY2lwaWVudFN0YXR1cyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiBhIG1lc3NhZ2UuXG4gICAqXG4gICAqIFNpbWlsYXIgdG8gX3BvcHVsYXRlRnJvbVNlcnZlciwgaG93ZXZlciwgdGhpcyBtZXRob2QgdGFrZXMgYVxuICAgKiBtZXNzYWdlIGRlc2NyaXB0aW9uIGFuZCByZXR1cm5zIGEgbmV3IG1lc3NhZ2UgaW5zdGFuY2UgdXNpbmcgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiB0byBzZXR1cCB0aGUgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1lc3NhZ2UgLSBTZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiB0aGUgbWVzc2FnZVxuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVGcm9tU2VydmVyKG1lc3NhZ2UsIGNsaWVudCkge1xuICAgIGNvbnN0IGZyb21XZWJzb2NrZXQgPSBtZXNzYWdlLmZyb21XZWJzb2NrZXQ7XG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlKHtcbiAgICAgIGNvbnZlcnNhdGlvbklkOiBtZXNzYWdlLmNvbnZlcnNhdGlvbi5pZCxcbiAgICAgIGZyb21TZXJ2ZXI6IG1lc3NhZ2UsXG4gICAgICBjbGllbnRJZDogY2xpZW50LmFwcElkLFxuICAgICAgX2Zyb21EQjogbWVzc2FnZS5fZnJvbURCLFxuICAgICAgX25vdGlmeTogZnJvbVdlYnNvY2tldCAmJiBtZXNzYWdlLmlzX3VucmVhZCAmJiBtZXNzYWdlLnNlbmRlci51c2VyX2lkICE9PSBjbGllbnQudXNlci51c2VySWQsXG4gICAgfSk7XG4gIH1cblxuICBfbG9hZGVkKGRhdGEpIHtcbiAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gZGF0YS5jb252ZXJzYXRpb24uaWQ7XG4gICAgdGhpcy5nZXRDbGllbnQoKS5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHdoZXRoZXIgYSBNZXNzYWdlIHJlY2VpdmluZyB0aGUgc3BlY2lmaWVkIHBhdGNoIGRhdGEgc2hvdWxkIGJlIGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEFwcGxpZXMgb25seSB0byBNZXNzYWdlcyB0aGF0IGFyZW4ndCBhbHJlYWR5IGxvYWRlZDsgdXNlZCB0byBpbmRpY2F0ZSBpZiBhIGNoYW5nZSBldmVudCBpc1xuICAgKiBzaWduaWZpY2FudCBlbm91Z2ggdG8gbG9hZCB0aGUgTWVzc2FnZSBhbmQgdHJpZ2dlciBjaGFuZ2UgZXZlbnRzIG9uIHRoYXQgTWVzc2FnZS5cbiAgICpcbiAgICogQXQgdGhpcyB0aW1lIHRoZXJlIGFyZSBubyBwcm9wZXJ0aWVzIHRoYXQgYXJlIHBhdGNoZWQgb24gTWVzc2FnZXMgdmlhIHdlYnNvY2tldHNcbiAgICogdGhhdCB3b3VsZCBqdXN0aWZ5IGxvYWRpbmcgdGhlIE1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyIHNvIGFzIHRvIG5vdGlmeSB0aGUgYXBwLlxuICAgKlxuICAgKiBPbmx5IHJlY2lwaWVudCBzdGF0dXMgY2hhbmdlcyBhbmQgbWF5YmUgaXNfdW5yZWFkIGNoYW5nZXMgYXJlIHNlbnQ7XG4gICAqIG5laXRoZXIgb2Ygd2hpY2ggYXJlIHJlbGV2YW50IHRvIGFuIGFwcCB0aGF0IGlzbid0IHJlbmRlcmluZyB0aGF0IG1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRSZXNvdXJjZUZvclBhdGNoXG4gICAqIEBzdGF0aWNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBfbG9hZFJlc291cmNlRm9yUGF0Y2gocGF0Y2hEYXRhKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogQ2xpZW50IHRoYXQgdGhlIE1lc3NhZ2UgYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgb2YgdGhpcyBzdHJpbmcgbWF0Y2hlcyB0aGUgYXBwSWQuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLmNsaWVudElkID0gJyc7XG5cbi8qKlxuICogQ29udmVyc2F0aW9uIHRoYXQgdGhpcyBNZXNzYWdlIGJlbG9uZ3MgdG8uXG4gKlxuICogQWN0dWFsIHZhbHVlIGlzIHRoZSBJRCBvZiB0aGUgQ29udmVyc2F0aW9uJ3MgSUQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5jb252ZXJzYXRpb25JZCA9ICcnO1xuXG4vKipcbiAqIEFycmF5IG9mIGxheWVyLk1lc3NhZ2VQYXJ0IG9iamVjdHMuXG4gKlxuICogVXNlIGxheWVyLk1lc3NhZ2UuYWRkUGFydCB0byBtb2RpZnkgdGhpcyBhcnJheS5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuTWVzc2FnZVBhcnRbXX1cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5wYXJ0cyA9IG51bGw7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBtZXNzYWdlIHdhcyBzZW50LlxuICpcbiAqICBOb3RlIHRoYXQgYSBsb2NhbGx5IGNyZWF0ZWQgbGF5ZXIuTWVzc2FnZSB3aWxsIGhhdmUgYSBgc2VudEF0YCB2YWx1ZSBldmVuXG4gKiB0aG91Z2ggaXRzIG5vdCB5ZXQgc2VudDsgdGhpcyBpcyBzbyB0aGF0IGFueSByZW5kZXJpbmcgY29kZSBkb2Vzbid0IG5lZWRcbiAqIHRvIGFjY291bnQgZm9yIGBudWxsYCB2YWx1ZXMuICBTZW5kaW5nIHRoZSBNZXNzYWdlIG1heSBjYXVzZSBhIHNsaWdodCBjaGFuZ2VcbiAqIGluIHRoZSBgc2VudEF0YCB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7RGF0ZX1cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5zZW50QXQgPSBudWxsO1xuXG4vKipcbiAqIFRpbWUgdGhhdCB0aGUgZmlyc3QgZGVsaXZlcnkgcmVjZWlwdCB3YXMgc2VudCBieSB5b3VyXG4gKiB1c2VyIGFja25vd2xlZGdpbmcgcmVjZWlwdCBvZiB0aGUgbWVzc2FnZS5cbiAqIEB0eXBlIHtEYXRlfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnJlY2VpdmVkQXQgPSBudWxsO1xuXG4vKipcbiAqIElkZW50aXR5IG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHNlbmRlciBvZiB0aGUgTWVzc2FnZS5cbiAqXG4gKiBNb3N0IGNvbW1vbmx5IHVzZWQgcHJvcGVydGllcyBvZiBJZGVudGl0eSBhcmU6XG4gKiAqIGRpc3BsYXlOYW1lOiBBIG5hbWUgZm9yIHlvdXIgVUlcbiAqICogdXNlcklkOiBOYW1lIGZvciB0aGUgdXNlciBhcyByZXByZXNlbnRlZCBvbiB5b3VyIHN5c3RlbVxuICogKiBuYW1lOiBSZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgc2VydmljZSBpZiB0aGUgc2VuZGVyIHdhcyBhbiBhdXRvbWF0ZWQgc3lzdGVtLlxuICpcbiAqICAgICAgPHNwYW4gY2xhc3M9J3NlbnQtYnknPlxuICogICAgICAgIHttZXNzYWdlLnNlbmRlci5kaXNwbGF5TmFtZSB8fCBtZXNzYWdlLnNlbmRlci5uYW1lfVxuICogICAgICA8L3NwYW4+XG4gKlxuICogQHR5cGUge2xheWVyLklkZW50aXR5fVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnNlbmRlciA9IG51bGw7XG5cbi8qKlxuICogUG9zaXRpb24gb2YgdGhpcyBtZXNzYWdlIHdpdGhpbiB0aGUgY29udmVyc2F0aW9uLlxuICpcbiAqIE5PVEVTOlxuICpcbiAqIDEuIERlbGV0aW5nIGEgbWVzc2FnZSBkb2VzIG5vdCBhZmZlY3QgcG9zaXRpb24gb2Ygb3RoZXIgTWVzc2FnZXMuXG4gKiAyLiBBIHBvc2l0aW9uIGlzIG5vdCBnYXVyZW50ZWVkIHRvIGJlIHVuaXF1ZSAobXVsdGlwbGUgbWVzc2FnZXMgc2VudCBhdCB0aGUgc2FtZSB0aW1lIGNvdWxkXG4gKiBhbGwgY2xhaW0gdGhlIHNhbWUgcG9zaXRpb24pXG4gKiAzLiBFYWNoIHN1Y2Nlc3NpdmUgbWVzc2FnZSB3aXRoaW4gYSBjb252ZXJzYXRpb24gc2hvdWxkIGV4cGVjdCBhIGhpZ2hlciBwb3NpdGlvbi5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnBvc2l0aW9uID0gMDtcblxuLyoqXG4gKiBIaW50IHVzZWQgYnkgbGF5ZXIuQ2xpZW50IG9uIHdoZXRoZXIgdG8gdHJpZ2dlciBhIG1lc3NhZ2VzOm5vdGlmeSBldmVudC5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLl9ub3RpZnkgPSBmYWxzZTtcblxuLyogUmVjaXBpZW50IFN0YXR1cyAqL1xuXG4vKipcbiAqIFJlYWQvZGVsaXZlcnkgU3RhdGUgb2YgYWxsIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBUaGlzIGlzIGFuIG9iamVjdCBjb250YWluaW5nIGtleXMgZm9yIGVhY2ggcGFydGljaXBhbnQsXG4gKiBhbmQgYSB2YWx1ZSBvZjpcbiAqICogbGF5ZXIuUkVDRUlQVF9TVEFURS5TRU5UXG4gKiAqIGxheWVyLlJFQ0VJUFRfU1RBVEUuREVMSVZFUkVEXG4gKiAqIGxheWVyLlJFQ0VJUFRfU1RBVEUuUkVBRFxuICogKiBsYXllci5SRUNFSVBUX1NUQVRFLlBFTkRJTkdcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5yZWNpcGllbnRTdGF0dXMgPSBudWxsO1xuXG4vKipcbiAqIFRydWUgaWYgdGhpcyBNZXNzYWdlIGhhcyBiZWVuIHJlYWQgYnkgdGhpcyB1c2VyLlxuICpcbiAqIFlvdSBjYW4gY2hhbmdlIGlzUmVhZCBwcm9ncmFtYXRpY2FsbHlcbiAqXG4gKiAgICAgIG0uaXNSZWFkID0gdHJ1ZTtcbiAqXG4gKiBUaGlzIHdpbGwgYXV0b21hdGljYWxseSBub3RpZnkgdGhlIHNlcnZlciB0aGF0IHRoZSBtZXNzYWdlIHdhcyByZWFkIGJ5IHlvdXIgdXNlci5cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5pc1JlYWQgPSBmYWxzZTtcblxuLyoqXG4gKiBUaGlzIHByb3BlcnR5IGlzIGhlcmUgZm9yIGNvbnZlbmllbmNlIG9ubHk7IGl0IHdpbGwgYWx3YXlzIGJlIHRoZSBvcHBvc2l0ZSBvZiBpc1JlYWQuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWVzc2FnZS5wcm90b3R5cGUsICdpc1VucmVhZCcsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzUmVhZDtcbiAgfSxcbn0pO1xuXG4vKipcbiAqIEhhdmUgdGhlIG90aGVyIHBhcnRpY2lwYW50cyByZWFkIHRoaXMgTWVzc2FnZSB5ZXQuXG4gKlxuICogVGhpcyB2YWx1ZSBpcyBvbmUgb2Y6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTExcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuU09NRVxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FXG4gKlxuICogIFRoaXMgdmFsdWUgaXMgdXBkYXRlZCBhbnkgdGltZSByZWNpcGllbnRTdGF0dXMgY2hhbmdlcy5cbiAqXG4gKiBTZWUgbGF5ZXIuTWVzc2FnZS5yZWNpcGllbnRTdGF0dXMgZm9yIGEgbW9yZSBkZXRhaWxlZCByZXBvcnQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORTtcblxuLyoqXG4gKiBIYXZlIHRoZSBvdGhlciBwYXJ0aWNpcGFudHMgcmVjZWl2ZWQgdGhpcyBNZXNzYWdlIHlldC5cbiAqXG4gICogVGhpcyB2YWx1ZSBpcyBvbmUgb2Y6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTExcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuU09NRVxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FXG4gKlxuICogIFRoaXMgdmFsdWUgaXMgdXBkYXRlZCBhbnkgdGltZSByZWNpcGllbnRTdGF0dXMgY2hhbmdlcy5cbiAqXG4gKiBTZWUgbGF5ZXIuTWVzc2FnZS5yZWNpcGllbnRTdGF0dXMgZm9yIGEgbW9yZSBkZXRhaWxlZCByZXBvcnQuXG4gKlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLmRlbGl2ZXJ5U3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FO1xuXG5NZXNzYWdlLnByb3RvdHlwZS5fdG9PYmplY3QgPSBudWxsO1xuXG5NZXNzYWdlLnByb3RvdHlwZS5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIgPSBmYWxzZTtcblxuTWVzc2FnZS5ldmVudFByZWZpeCA9ICdtZXNzYWdlcyc7XG5cbk1lc3NhZ2UuZXZlbnRQcmVmaXggPSAnbWVzc2FnZXMnO1xuXG5NZXNzYWdlLnByZWZpeFVVSUQgPSAnbGF5ZXI6Ly8vbWVzc2FnZXMvJztcblxuTWVzc2FnZS5pbk9iamVjdElnbm9yZSA9IFN5bmNhYmxlLmluT2JqZWN0SWdub3JlO1xuXG5NZXNzYWdlLmJ1YmJsZUV2ZW50UGFyZW50ID0gJ2dldENsaWVudCc7XG5cbk1lc3NhZ2UuaW1hZ2VUeXBlcyA9IFtcbiAgJ2ltYWdlL2dpZicsXG4gICdpbWFnZS9wbmcnLFxuICAnaW1hZ2UvanBlZycsXG4gICdpbWFnZS9qcGcnLFxuXTtcblxuTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzID0gW1xuXG4gIC8qKlxuICAgKiBNZXNzYWdlIGhhcyBiZWVuIGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuTWVzc2FnZS5sb2FkKCkgbWV0aG9kLlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIG0gPSBjbGllbnQuZ2V0TWVzc2FnZSgnbGF5ZXI6Ly8vbWVzc2FnZXMvMTIzJywgdHJ1ZSlcbiAgICogICAgLm9uKCdtZXNzYWdlczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgIG15cmVyZW5kZXIobSk7XG4gICAqICAgIH0pO1xuICAgKiBteXJlbmRlcihtKTsgLy8gcmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIG0gdW50aWwgdGhlIGRldGFpbHMgb2YgbSBoYXZlIGxvYWRlZFxuICAgKiBgYGBcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6bG9hZGVkJyxcblxuICAvKipcbiAgICogVGhlIGxvYWQgbWV0aG9kIGZhaWxlZCB0byBsb2FkIHRoZSBtZXNzYWdlIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIHRoZSBsYXllci5NZXNzYWdlLmxvYWQoKSBtZXRob2QuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgJ21lc3NhZ2VzOmxvYWRlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhdXNlZCBieSBhIGNhbGwgdG8gbGF5ZXIuTWVzc2FnZS5kZWxldGUoKSBvciBhIHdlYnNvY2tldCBldmVudC5cbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQGV2ZW50XG4gICAqL1xuICAnbWVzc2FnZXM6ZGVsZXRlJyxcblxuICAvKipcbiAgICogTWVzc2FnZSBpcyBhYm91dCB0byBiZSBzZW50LlxuICAgKlxuICAgKiBMYXN0IGNoYW5jZSB0byBtb2RpZnkgb3IgdmFsaWRhdGUgdGhlIG1lc3NhZ2UgcHJpb3IgdG8gc2VuZGluZy5cbiAgICpcbiAgICogICAgIG1lc3NhZ2Uub24oJ21lc3NhZ2VzOnNlbmRpbmcnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgIG1lc3NhZ2UuYWRkUGFydCh7bWltZVR5cGU6ICdhcHBsaWNhdGlvbi9sb2NhdGlvbicsIGJvZHk6IEpTT04uc3RyaW5naWZ5KGdldEdQU0xvY2F0aW9uKCkpfSk7XG4gICAqICAgICB9KTtcbiAgICpcbiAgICogVHlwaWNhbGx5LCB5b3Ugd291bGQgbGlzdGVuIHRvIHRoaXMgZXZlbnQgbW9yZSBicm9hZGx5IHVzaW5nIGBjbGllbnQub24oJ21lc3NhZ2VzOnNlbmRpbmcnKWBcbiAgICogd2hpY2ggd291bGQgdHJpZ2dlciBiZWZvcmUgc2VuZGluZyBBTlkgTWVzc2FnZXMuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgJ21lc3NhZ2VzOnNlbmRpbmcnLFxuXG4gIC8qKlxuICAgKiBNZXNzYWdlIGhhcyBiZWVuIHJlY2VpdmVkIGJ5IHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEl0IGRvZXMgTk9UIGluZGljYXRlIGRlbGl2ZXJ5IHRvIG90aGVyIHVzZXJzLlxuICAgKlxuICAgKiBJdCBkb2VzIE5PVCBpbmRpY2F0ZSBtZXNzYWdlcyBzZW50IGJ5IG90aGVyIHVzZXJzLlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gICdtZXNzYWdlczpzZW50JyxcblxuICAvKipcbiAgICogU2VydmVyIGZhaWxlZCB0byByZWNlaXZlIHRoZSBNZXNzYWdlLlxuICAgKlxuICAgKiBNZXNzYWdlIHdpbGwgYmUgZGVsZXRlZCBpbW1lZGlhdGVseSBhZnRlciBmaXJpbmcgdGhpcyBldmVudC5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZ0LmVycm9yXG4gICAqL1xuICAnbWVzc2FnZXM6c2VudC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSByZWNpcGllbnRTdGF0dXMgcHJvcGVydHkgaGFzIGNoYW5nZWQuXG4gICAqXG4gICAqIFRoaXMgaGFwcGVucyBpbiByZXNwb25zZSB0byBhbiB1cGRhdGVcbiAgICogZnJvbSB0aGUgc2VydmVyLi4uIGJ1dCBpcyBhbHNvIGNhdXNlZCBieSBtYXJraW5nIHRoZSBjdXJyZW50IHVzZXIgYXMgaGF2aW5nIHJlYWRcbiAgICogb3IgcmVjZWl2ZWQgdGhlIG1lc3NhZ2UuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgJ21lc3NhZ2VzOmNoYW5nZScsXG5cblxuXS5jb25jYXQoU3luY2FibGUuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KE1lc3NhZ2UsIFtNZXNzYWdlLCAnTWVzc2FnZSddKTtcblN5bmNhYmxlLnN1YmNsYXNzZXMucHVzaChNZXNzYWdlKTtcbm1vZHVsZS5leHBvcnRzID0gTWVzc2FnZTtcbiJdfQ==
