'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * A Conversation object represents a dialog amongst a set
 * of participants.
 *
 * Create a Conversation using the client:
 *
 *      var conversation = client.createConversation({
 *          participants: ['a','b'],
 *          distinct: true
 *      });
 *
 * NOTE:   Do not create a conversation with new layer.Conversation(...),
 *         This will fail to handle the distinct property short of going to the server for evaluation.
 *
 * NOTE:   Creating a Conversation is a local action.  A Conversation will not be
 *         sent to the server until either:
 *
 * 1. A message is sent on that Conversation
 * 2. `Conversation.send()` is called (not recommended as mobile clients
 *    expect at least one layer.Message in a Conversation)
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Conversation.id: this property is worth being familiar with; it identifies the
 *   Conversation and can be used in `client.getConversation(id)` to retrieve it.
 * * layer.Conversation.lastMessage: This property makes it easy to show info about the most recent Message
 *    when rendering a list of Conversations.
 * * layer.Conversation.metadata: Custom data for your Conversation; commonly used to store a 'title' property
 *    to name your Conversation.
 *
 * Methods:
 *
 * * layer.Conversation.addParticipants and layer.Conversation.removeParticipants: Change the participants of the Conversation
 * * layer.Conversation.setMetadataProperties: Set metadata.title to 'My Conversation with Layer Support' (uh oh)
 * * layer.Conversation.on() and layer.Conversation.off(): event listeners built on top of the `backbone-events-standalone` npm project
 * * layer.Conversation.leave() to leave the Conversation
 * * layer.Conversation.delete() to delete the Conversation for all users (or for just this user)
 *
 * Events:
 *
 * * `conversations:change`: Useful for observing changes to participants and metadata
 *   and updating rendering of your open Conversation
 *
 * Finally, to access a list of Messages in a Conversation, see layer.Query.
 *
 * @class  layer.Conversation
 * @extends layer.Syncable
 * @author  Michael Kantor
 */

var Syncable = require('./syncable');
var Message = require('./message');
var LayerError = require('./layer-error');
var Util = require('./client-utils');
var Constants = require('./const');
var Root = require('./root');
var LayerEvent = require('./layer-event');

var Conversation = function (_Syncable) {
  _inherits(Conversation, _Syncable);

  /**
   * Create a new conversation.
   *
   * The static `layer.Conversation.create()` method
   * will correctly lookup distinct Conversations and
   * return them; `new layer.Conversation()` will not.
   *
   * Developers should use `layer.Conversation.create()`.
   *
   * @method constructor
   * @protected
   * @param  {Object} options
   * @param {string[]/layer.Identity[]} options.participants - Array of Participant IDs or layer.Identity instances
   * @param {boolean} [options.distinct=true] - Is the conversation distinct
   * @param {Object} [options.metadata] - An object containing Conversation Metadata.
   * @return {layer.Conversation}
   */
  function Conversation() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Conversation);

    // Setup default values
    if (!options.participants) options.participants = [];
    if (!options.metadata) options.metadata = {};

    // Make sure the ID from handle fromServer parameter is used by the Root.constructor
    if (options.fromServer) options.id = options.fromServer.id;

    // Make sure we have an clientId property
    if (options.client) options.clientId = options.client.appId;

    var _this = _possibleConstructorReturn(this, (Conversation.__proto__ || Object.getPrototypeOf(Conversation)).call(this, options));

    _this.isInitializing = true;
    var client = _this.getClient();

    // If the options contains a full server definition of the object,
    // copy it in with _populateFromServer; this will add the Conversation
    // to the Client as well.
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    }

    // Setup participants
    else {
        _this.participants = client._fixIdentities(_this.participants);

        if (_this.participants.indexOf(client.user) === -1) {
          _this.participants.push(client.user);
        }
      }

    if (!_this.createdAt) {
      _this.createdAt = new Date();
    }

    client._addConversation(_this);
    _this.isInitializing = false;
    return _this;
  }

  /**
   * Destroy the local copy of this Conversation, cleaning up all resources
   * it consumes.
   *
   * @method destroy
   */


  _createClass(Conversation, [{
    key: 'destroy',
    value: function destroy() {
      this.lastMessage = null;

      // Client fires 'conversations:remove' and then removes the Conversation.
      if (this.clientId) this.getClient()._removeConversation(this);

      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), 'destroy', this).call(this);

      this.participants = null;
      this.metadata = null;
    }

    /**
     * Create this Conversation on the server.
     *
     * On completion, this instance will receive
     * an id, url and createdAt.  It may also receive metadata
     * if there was a FOUND_WITHOUT_REQUESTED_METADATA result.
     *
     * Note that the optional Message parameter should NOT be used except
     * by the layer.Message class itself.
     *
     * Note that recommended practice is to send the Conversation by sending a Message in the Conversation,
     * and NOT by calling Conversation.send.
     *
     *      client.createConversation({
     *          participants: ['a', 'b'],
     *          distinct: false
     *      })
     *      .send()
     *      .on('conversations:sent', function(evt) {
     *          alert('Done');
     *      });
     *
     * @method send
     * @param {layer.Message} [message] Tells the Conversation what its last_message will be
     * @return {layer.Conversation} this
     */

  }, {
    key: 'send',
    value: function send(message) {
      var _this2 = this;

      var client = this.getClient();
      if (!client) throw new Error(LayerError.dictionary.clientMissing);

      // If this is part of a create({distinct:true}).send() call where
      // the distinct conversation was found, just trigger the cached event and exit
      var wasLocalDistinct = Boolean(this._sendDistinctEvent);
      if (this._sendDistinctEvent) this._handleLocalDistinctConversation();

      // If a message is passed in, then that message is being sent, and is our
      // new lastMessage (until the websocket tells us otherwise)
      if (message) {
        // Setting a position is required if its going to get sorted correctly by query.
        // The correct position will be written by _populateFromServer when the object
        // is returned from the server.  We increment the position by the time since the prior lastMessage was sent
        // so that if multiple tabs are sending messages and writing them to indexedDB, they will have positions in correct chronological order.
        // WARNING: The query will NOT be resorted using the server's position value.
        var position = void 0;
        if (this.lastMessage) {
          position = this.lastMessage.position + Date.now() - this.lastMessage.sentAt.getTime();
          if (position === this.lastMessage.position) position++;
        } else {
          position = 0;
        }
        message.position = position;
        this.lastMessage = message;
      }

      // If the Conversation is already on the server, don't send.
      if (wasLocalDistinct || this.syncState !== Constants.SYNC_STATE.NEW) return this;

      // Make sure this user is a participant (server does this for us, but
      // this insures the local copy is correct until we get a response from
      // the server
      if (this.participants.indexOf(client.user) === -1) {
        this.participants.push(client.user);
      }

      // If there is only one participant, its client.user.userId.  Not enough
      // for us to have a good Conversation on the server.  Abort.
      if (this.participants.length === 1) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }

      this.createdAt = new Date();

      // Update the syncState
      this._setSyncing();

      client.sendSocketRequest({
        method: 'POST',
        body: {}, // see _getSendData
        sync: {
          depends: this.id,
          target: this.id
        }
      }, function (result) {
        return _this2._createResult(result);
      });
      return this;
    }

    /**
     * Handles the case where a Distinct Create Conversation found a local match.
     *
     * When an app calls client.createConversation([...])
     * and requests a Distinct Conversation (default setting),
     * and the Conversation already exists, what do we do to help
     * them access it?
     *
     *      client.createConversation(["fred"]).on("conversations:sent", function(evt) {
     *        render();
     *      });
     *
     * Under normal conditions, calling `c.send()` on a matching distinct Conversation
     * would either throw an error or just be a no-op.  We use this method to trigger
     * the expected "conversations:sent" event even though its already been sent and
     * we did nothing.  Use the evt.result property if you want to know whether the
     * result was a new conversation or matching one.
     *
     * @method _handleLocalDistinctConversation
     * @private
     */

  }, {
    key: '_handleLocalDistinctConversation',
    value: function _handleLocalDistinctConversation() {
      var evt = this._sendDistinctEvent;
      this._sendDistinctEvent = null;

      // delay so there is time to setup an event listener on this conversation
      this._triggerAsync('conversations:sent', evt);
      return this;
    }

    /**
     * Gets the data for a Create request.
     *
     * The layer.SyncManager needs a callback to create the Conversation as it
     * looks NOW, not back when `send()` was called.  This method is called
     * by the layer.SyncManager to populate the POST data of the call.
     *
     * @method _getSendData
     * @private
     * @return {Object} Websocket data for the request
     */

  }, {
    key: '_getSendData',
    value: function _getSendData(data) {
      var isMetadataEmpty = Util.isEmpty(this.metadata);
      return {
        method: 'Conversation.create',
        data: {
          participants: this.participants.map(function (identity) {
            return identity.id;
          }),
          distinct: this.distinct,
          metadata: isMetadataEmpty ? null : this.metadata,
          id: this.id
        }
      };
    }

    /**
     * Process result of send method.
     *
     * Note that we use _triggerAsync so that
     * events reporting changes to the layer.Conversation.id can
     * be applied before reporting on it being sent.
     *
     * Example: Query will now have the resolved Distinct IDs rather than the proposed ID
     * when this event is triggered.
     *
     * @method _createResult
     * @private
     * @param  {Object} result
     */

  }, {
    key: '_createResult',
    value: function _createResult(_ref) {
      var success = _ref.success,
          data = _ref.data;

      if (this.isDestroyed) return;
      if (success) {
        this._createSuccess(data);
      } else if (data.id === 'conflict') {
        this._populateFromServer(data.data);
        this._triggerAsync('conversations:sent', {
          result: Conversation.FOUND_WITHOUT_REQUESTED_METADATA
        });
      } else {
        this.trigger('conversations:sent-error', { error: data });
        this.destroy();
      }
    }

    /**
     * Process the successful result of a create call
     *
     * @method _createSuccess
     * @private
     * @param  {Object} data Server description of Conversation
     */

  }, {
    key: '_createSuccess',
    value: function _createSuccess(data) {
      this._populateFromServer(data);
      if (!this.distinct) {
        this._triggerAsync('conversations:sent', {
          result: Conversation.CREATED
        });
      } else {
        // Currently the websocket does not tell us if its
        // returning an existing Conversation.  So guess...
        // if there is no lastMessage, then most likely, there was
        // no existing Conversation.  Sadly, API-834; last_message is currently
        // always null.
        this._triggerAsync('conversations:sent', {
          result: !this.lastMessage ? Conversation.CREATED : Conversation.FOUND
        });
      }
    }

    /**
     * Populates this instance using server-data.
     *
     * Side effects add this to the Client.
     *
     * @method _populateFromServer
     * @private
     * @param  {Object} conversation - Server representation of the conversation
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(conversation) {
      var client = this.getClient();

      // Disable events if creating a new Conversation
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this._setSynced();

      var id = this.id;
      this.id = conversation.id;

      // IDs change if the server returns a matching Distinct Conversation
      if (id !== this.id) {
        client._updateConversationId(this, id);
        this._triggerAsync('conversations:change', {
          oldValue: id,
          newValue: this.id,
          property: 'id'
        });
      }

      this.url = conversation.url;
      this.participants = client._fixIdentities(conversation.participants);
      this.distinct = conversation.distinct;
      this.createdAt = new Date(conversation.created_at);
      this.metadata = conversation.metadata;
      this.unreadCount = conversation.unread_message_count;
      this.isCurrentParticipant = this.participants.indexOf(client.user) !== -1;

      client._addConversation(this);

      if (typeof conversation.last_message === 'string') {
        this.lastMessage = client.getMessage(conversation.last_message);
      } else if (conversation.last_message) {
        this.lastMessage = client._createObject(conversation.last_message);
      } else {
        this.lastMessage = null;
      }

      this._disableEvents = false;
    }

    /**
     * Add an array of participant ids to the conversation.
     *
     *      conversation.addParticipants(['a', 'b']);
     *
     * New participants will immediately show up in the Conversation,
     * but may not have synced with the server yet.
     *
     * TODO WEB-967: Roll participants back on getting a server error
     *
     * @method addParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'addParticipants',
    value: function addParticipants(participants) {
      var _this3 = this;

      // Only add those that aren't already in the list.
      var client = this.getClient();
      var identities = client._fixIdentities(participants);
      var adding = identities.filter(function (identity) {
        return _this3.participants.indexOf(identity) === -1;
      });
      this._patchParticipants({ add: adding, remove: [] });
      return this;
    }

    /**
     * Removes an array of participant ids from the conversation.
     *
     *      conversation.removeParticipants(['a', 'b']);
     *
     * Removed participants will immediately be removed from this Conversation,
     * but may not have synced with the server yet.
     *
     * Throws error if you attempt to remove ALL participants.
     *
     * TODO  WEB-967: Roll participants back on getting a server error
     *
     * @method removeParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'removeParticipants',
    value: function removeParticipants(participants) {
      var currentParticipants = {};
      this.participants.forEach(function (participant) {
        return currentParticipants[participant.id] = true;
      });
      var client = this.getClient();
      var identities = client._fixIdentities(participants);

      var removing = identities.filter(function (participant) {
        return currentParticipants[participant.id];
      });
      if (removing.length === 0) return this;
      if (removing.length === this.participants.length) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }
      this._patchParticipants({ add: [], remove: removing });
      return this;
    }

    /**
     * Replaces all participants with a new array of of participant ids.
     *
     *      conversation.replaceParticipants(['a', 'b']);
     *
     * Changed participants will immediately show up in the Conversation,
     * but may not have synced with the server yet.
     *
     * TODO WEB-967: Roll participants back on getting a server error
     *
     * @method replaceParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'replaceParticipants',
    value: function replaceParticipants(participants) {
      if (!participants || !participants.length) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }

      var client = this.getClient();
      var identities = client._fixIdentities(participants);

      var change = this._getParticipantChange(identities, this.participants);
      this._patchParticipants(change);
      return this;
    }

    /**
     * Update the server with the new participant list.
     *
     * Executes as follows:
     *
     * 1. Updates the participants property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method _patchParticipants
     * @private
     * @param  {Object[]} operations - Array of JSON patch operation
     * @param  {Object} eventData - Data describing the change for use in an event
     */

  }, {
    key: '_patchParticipants',
    value: function _patchParticipants(change) {
      var _this4 = this;

      this._applyParticipantChange(change);
      this.isCurrentParticipant = this.participants.indexOf(this.getClient().user) !== -1;

      var ops = [];
      change.remove.forEach(function (participant) {
        ops.push({
          operation: 'remove',
          property: 'participants',
          id: participant.id
        });
      });

      change.add.forEach(function (participant) {
        ops.push({
          operation: 'add',
          property: 'participants',
          id: participant.id
        });
      });

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(ops),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success) _this4._load();
      });
    }

    /**
     * Internally we use `{add: [], remove: []}` instead of LayerOperations.
     *
     * So control is handed off to this method to actually apply the changes
     * to the participants array.
     *
     * @method _applyParticipantChange
     * @private
     * @param  {Object} change
     * @param  {layer.Identity[]} change.add - Array of userids to add
     * @param  {layer.Identity[]} change.remove - Array of userids to remove
     */

  }, {
    key: '_applyParticipantChange',
    value: function _applyParticipantChange(change) {
      var participants = [].concat(this.participants);
      change.add.forEach(function (participant) {
        if (participants.indexOf(participant) === -1) participants.push(participant);
      });
      change.remove.forEach(function (participant) {
        var index = participants.indexOf(participant);
        if (index !== -1) participants.splice(index, 1);
      });
      this.participants = participants;
    }

    /**
     * Delete the Conversation from the server and removes this user as a participant.
     *
     * @method leave
     */

  }, {
    key: 'leave',
    value: function leave() {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      this._delete('mode=' + Constants.DELETION_MODE.MY_DEVICES + '&leave=true');
    }

    /**
     * Delete the Conversation from the server, but deletion mode may cause user to remain a participant.
     *
     * This call will support various deletion modes.
     *
     * Deletion Modes:
     *
     * * layer.Constants.DELETION_MODE.ALL: This deletes the local copy immediately, and attempts to also
     *   delete the server's copy.
     * * layer.Constants.DELETION_MODE.MY_DEVICES: Deletes the local copy immediately, and attempts to delete it from all
     *   of my devices.  Other users retain access.
     * * true: For backwards compatibility thi is the same as ALL.
     *
     * MY_DEVICES does not remove this user as a participant.  That means a new Message on this Conversation will recreate the
     * Conversation for this user.  See layer.Conversation.leave() instead.
     *
     * Executes as follows:
     *
     * 1. Submits a request to be sent to the server to delete the server's object
     * 2. Delete's the local object
     * 3. If there is an error, no errors are fired except by layer.SyncManager, but the Conversation will be reloaded from the server,
     *    triggering a conversations:add event.
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
          queryStr = 'mode=' + Constants.DELETION_MODE.ALL;
          break;
        case Constants.DELETION_MODE.MY_DEVICES:
          queryStr = 'mode=' + Constants.DELETION_MODE.MY_DEVICES + '&leave=false';
          break;
        default:
          throw new Error(LayerError.dictionary.deletionModeUnsupported);
      }

      this._delete(queryStr);
    }

    /**
     * Delete the Conversation from the server (internal version).
     *
     * This version of Delete takes a Query String that is packaged up by
     * layer.Conversation.delete and layer.Conversation.leave.
     *
     * @method _delete
     * @private
     * @param {string} queryStr - Query string for the DELETE request
     */

  }, {
    key: '_delete',
    value: function _delete(queryStr) {
      var id = this.id;
      var client = this.getClient();
      this._xhr({
        method: 'DELETE',
        url: '?' + queryStr
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Conversation.load(id, client);
      });

      this._deleted();
      this.destroy();
    }
  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      if (data.mode === Constants.DELETION_MODE.MY_DEVICES && data.from_position) {
        this.getClient()._purgeMessagesByPosition(this.id, data.from_position);
      } else {
        _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), '_handleWebsocketDelete', this).call(this);
      }
    }

    /**
     * Create a new layer.Message instance within this conversation
     *
     *      var message = conversation.createMessage('hello');
     *
     *      var message = conversation.createMessage({
     *          parts: [new layer.MessagePart({
     *                      body: 'hello',
     *                      mimeType: 'text/plain'
     *                  })]
     *      });
     *
     * See layer.Message for more options for creating the message.
     *
     * @method createMessage
     * @param  {string|Object} options - If its a string, a MessagePart is created around that string.
     * @param {layer.MessagePart[]} options.parts - An array of MessageParts.  There is some tolerance for
     *                                               it not being an array, or for it being a string to be turned
     *                                               into a MessagePart.
     * @return {layer.Message}
     */

  }, {
    key: 'createMessage',
    value: function createMessage() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var messageConfig = typeof options === 'string' ? {
        parts: [{ body: options, mimeType: 'text/plain' }]
      } : options;
      messageConfig.clientId = this.clientId;
      messageConfig.conversationId = this.id;

      return new Message(messageConfig);
    }

    /**
     * LayerPatch will call this after changing any properties.
     *
     * Trigger any cleanup or events needed after these changes.
     *
     * @method _handlePatchEvent
     * @private
     * @param  {Mixed} newValue - New value of the property
     * @param  {Mixed} oldValue - Prior value of the property
     * @param  {string[]} paths - Array of paths specifically modified: ['participants'], ['metadata.keyA', 'metadata.keyB']
     */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      var _this5 = this;

      // Certain types of __update handlers are disabled while values are being set by
      // layer patch parser because the difference between setting a value (triggers an event)
      // and change a property of a value (triggers only this callback) result in inconsistent
      // behaviors.  Enable them long enough to allow __update calls to be made
      this._inLayerParser = false;
      try {
        var events = this._disableEvents;
        this._disableEvents = false;
        if (paths[0].indexOf('metadata') === 0) {
          this.__updateMetadata(newValue, oldValue, paths);
        } else if (paths[0] === 'participants') {
          (function () {
            var client = _this5.getClient();
            // oldValue/newValue come as a Basic Identity POJO; lets deliver events with actual instances
            oldValue = oldValue.map(function (identity) {
              return client.getIdentity(identity.id);
            });
            newValue = newValue.map(function (identity) {
              return client.getIdentity(identity.id);
            });
            _this5.__updateParticipants(newValue, oldValue);
          })();
        }
        this._disableEvents = events;
      } catch (err) {
        // do nothing
      }
      this._inLayerParser = true;
    }

    /**
     * Given the oldValue and newValue for participants,
     * generate a list of whom was added and whom was removed.
     *
     * @method _getParticipantChange
     * @private
     * @param  {layer.Identity[]} newValue
     * @param  {layer.Identity[]} oldValue
     * @return {Object} Returns changes in the form of `{add: [...], remove: [...]}`
     */

  }, {
    key: '_getParticipantChange',
    value: function _getParticipantChange(newValue, oldValue) {
      var change = {};
      change.add = newValue.filter(function (participant) {
        return oldValue.indexOf(participant) === -1;
      });
      change.remove = oldValue.filter(function (participant) {
        return newValue.indexOf(participant) === -1;
      });
      return change;
    }

    /**
     * Updates specified metadata keys.
     *
     * Updates the local object's metadata and syncs the change to the server.
     *
     *      conversation.setMetadataProperties({
     *          'title': 'I am a title',
     *          'colors.background': 'red',
     *          'colors.text': {
     *              'fill': 'blue',
     *              'shadow': 'black'
     *           },
     *           'colors.title.fill': 'red'
     *      });
     *
     * Use setMetadataProperties to specify the path to a property, and a new value for that property.
     * Multiple properties can be changed this way.  Whatever value was there before is
     * replaced with the new value; so in the above example, whatever other keys may have
     * existed under `colors.text` have been replaced by the new object `{fill: 'blue', shadow: 'black'}`.
     *
     * Note also that only string and subobjects are accepted as values.
     *
     * Keys with '.' will update a field of an object (and create an object if it wasn't there):
     *
     * Initial metadata: {}
     *
     *      conversation.setMetadataProperties({
     *          'colors.background': 'red',
     *      });
     *
     * Metadata is now: `{colors: {background: 'red'}}`
     *
     *      conversation.setMetadataProperties({
     *          'colors.foreground': 'black',
     *      });
     *
     * Metadata is now: `{colors: {background: 'red', foreground: 'black'}}`
     *
     * Executes as follows:
     *
     * 1. Updates the metadata property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method setMetadataProperties
     * @param  {Object} properties
     * @return {layer.Conversation} this
     *
     */

  }, {
    key: 'setMetadataProperties',
    value: function setMetadataProperties(props) {
      var _this6 = this;

      var layerPatchOperations = [];
      Object.keys(props).forEach(function (name) {
        var fullName = name;
        if (name) {
          if (name !== 'metadata' && name.indexOf('metadata.') !== 0) {
            fullName = 'metadata.' + name;
          }
          layerPatchOperations.push({
            operation: 'set',
            property: fullName,
            value: props[name]
          });
        }
      });

      this._inLayerParser = true;

      // Do this before setSyncing as if there are any errors, we should never even
      // start setting up a request.
      Util.layerParse({
        object: this,
        type: 'Conversation',
        operations: layerPatchOperations,
        client: this.getClient()
      });
      this._inLayerParser = false;

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(layerPatchOperations),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success && !_this6.isDestroyed) _this6._load();
      });

      return this;
    }

    /**
     * Deletes specified metadata keys.
     *
     * Updates the local object's metadata and syncs the change to the server.
     *
     *      conversation.deleteMetadataProperties(
     *          ['title', 'colors.background', 'colors.title.fill']
     *      );
     *
     * Use deleteMetadataProperties to specify paths to properties to be deleted.
     * Multiple properties can be deleted.
     *
     * Executes as follows:
     *
     * 1. Updates the metadata property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method deleteMetadataProperties
     * @param  {string[]} properties
     * @return {layer.Conversation} this
     */

  }, {
    key: 'deleteMetadataProperties',
    value: function deleteMetadataProperties(props) {
      var _this7 = this;

      var layerPatchOperations = [];
      props.forEach(function (property) {
        if (property !== 'metadata' && property.indexOf('metadata.') !== 0) {
          property = 'metadata.' + property;
        }
        layerPatchOperations.push({
          operation: 'delete',
          property: property
        });
      }, this);

      this._inLayerParser = true;

      // Do this before setSyncing as if there are any errors, we should never even
      // start setting up a request.
      Util.layerParse({
        object: this,
        type: 'Conversation',
        operations: layerPatchOperations,
        client: this.getClient()
      });
      this._inLayerParser = false;

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(layerPatchOperations),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success) _this7._load();
      });

      return this;
    }
  }, {
    key: '_getUrl',
    value: function _getUrl(url) {
      return this.url + (url || '');
    }
  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.getClient()._addConversation(this);
    }

    /**
     * Standard `on()` provided by layer.Root.
     *
     * Adds some special handling of 'conversations:loaded' so that calls such as
     *
     *      var c = client.getConversation('layer:///conversations/123', true)
     *      .on('conversations:loaded', function() {
     *          myrerender(c);
     *      });
     *      myrender(c); // render a placeholder for c until the details of c have loaded
     *
     * can fire their callback regardless of whether the client loads or has
     * already loaded the Conversation.
     *
     * @method on
     * @param  {string} eventName
     * @param  {Function} callback
     * @param  {Object} context
     * @return {layer.Conversation} this
     */

  }, {
    key: 'on',
    value: function on(name, callback, context) {
      var hasLoadedEvt = name === 'conversations:loaded' || name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object' && name['conversations:loaded'];

      if (hasLoadedEvt && !this.isLoading) {
        (function () {
          var callNow = name === 'conversations:loaded' ? callback : name['conversations:loaded'];
          Util.defer(function () {
            return callNow.apply(context);
          });
        })();
      }
      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), 'on', this).call(this, name, callback, context);

      return this;
    }

    /*
     * Insure that conversation.unreadCount-- can never reduce the value to negative values.
     */

  }, {
    key: '__adjustUnreadCount',
    value: function __adjustUnreadCount(newValue) {
      if (newValue < 0) return 0;
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the unreadCount property will call this method and fire a
     * change event.
     *
     * Any triggering of this from a websocket patch unread_message_count should wait a second before firing any events
     * so that if there are a series of these updates, we don't see a lot of jitter.
     *
     * NOTE: _oldUnreadCount is used to pass data to _updateUnreadCountEvent because this method can be called many times
     * a second, and we only want to trigger this with a summary of changes rather than each individual change.
     *
     * @method __updateUnreadCount
     * @private
     * @param  {number} newValue
     * @param  {number} oldValue
     */

  }, {
    key: '__updateUnreadCount',
    value: function __updateUnreadCount(newValue, oldValue) {
      var _this8 = this;

      if (this._inLayerParser) {
        if (this._oldUnreadCount === undefined) this._oldUnreadCount = oldValue;
        if (this._updateUnreadCountTimeout) clearTimeout(this._updateUnreadCountTimeout);
        this._updateUnreadCountTimeout = setTimeout(function () {
          return _this8._updateUnreadCountEvent();
        }, 1000);
      } else {
        this._updateUnreadCountEvent();
      }
    }

    /**
     * Fire events related to changes to unreadCount
     *
     * @method _updateUnreadCountEvent
     * @private
     */

  }, {
    key: '_updateUnreadCountEvent',
    value: function _updateUnreadCountEvent() {
      if (this.isDestroyed) return;
      var oldValue = this._oldUnreadCount;
      var newValue = this.__unreadCount;
      this._oldUnreadCount = undefined;

      if (newValue === oldValue) return;
      this._triggerAsync('conversations:change', {
        newValue: newValue,
        oldValue: oldValue,
        property: 'unreadCount'
      });
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the lastMessage pointer will call this method and fire a
     * change event.  Changes to properties within the lastMessage object will
     * not trigger this call.
     *
     * @method __updateLastMessage
     * @private
     * @param  {layer.Message} newValue
     * @param  {layer.Message} oldValue
     */

  }, {
    key: '__updateLastMessage',
    value: function __updateLastMessage(newValue, oldValue) {
      if (newValue && oldValue && newValue.id === oldValue.id) return;
      this._triggerAsync('conversations:change', {
        property: 'lastMessage',
        newValue: newValue,
        oldValue: oldValue
      });
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the participants property will call this method and fire a
     * change event.  Changes to the participants array that don't replace the array
     * with a new array will require directly calling this method.
     *
     * @method __updateParticipants
     * @private
     * @param  {string[]} newValue
     * @param  {string[]} oldValue
     */

  }, {
    key: '__updateParticipants',
    value: function __updateParticipants(newValue, oldValue) {
      if (this._inLayerParser) return;
      var change = this._getParticipantChange(newValue, oldValue);
      if (change.add.length || change.remove.length) {
        change.property = 'participants';
        change.oldValue = oldValue;
        change.newValue = newValue;
        this._triggerAsync('conversations:change', change);
      }
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the metadata property will call this method and fire a
     * change event.  Changes to the metadata object that don't replace the object
     * with a new object will require directly calling this method.
     *
     * @method __updateMetadata
     * @private
     * @param  {Object} newValue
     * @param  {Object} oldValue
     */

  }, {
    key: '__updateMetadata',
    value: function __updateMetadata(newValue, oldValue, paths) {
      if (this._inLayerParser) return;
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        this._triggerAsync('conversations:change', {
          property: 'metadata',
          newValue: newValue,
          oldValue: oldValue,
          paths: paths
        });
      }
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Conversation instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), 'toObject', this).call(this);
        this._toObject.metadata = Util.clone(this.metadata);
      }
      return this._toObject;
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Create a conversation instance from a server representation of the conversation.
     *
     * If the Conversation already exists, will update the existing copy with
     * presumably newer values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} conversation - Server representation of a Conversation
     * @param  {layer.Client} client
     * @return {layer.Conversation}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(conversation, client) {
      return new Conversation({
        client: client,
        fromServer: conversation,
        _fromDB: conversation._fromDB
      });
    }

    /**
     * Find or create a new converation.
     *
     *      var conversation = layer.Conversation.create({
     *          participants: ['a', 'b'],
     *          distinct: true,
     *          metadata: {
     *              title: 'I am not a title!'
     *          },
     *          client: client,
     *          'conversations:loaded': function(evt) {
     *
     *          }
     *      });
     *
     * Only tries to find a Conversation if its a Distinct Conversation.
     * Distinct defaults to true.
     *
     * Recommend using `client.createConversation({...})`
     * instead of `Conversation.create({...})`.
     *
     * @method create
     * @static
     * @protected
     * @param  {Object} options
     * @param  {layer.Client} options.client
     * @param  {string[]/layer.Identity[]} options.participants - Array of Participant IDs or layer.Identity objects to create a conversation with.
     * @param {boolean} [options.distinct=true] - Create a distinct conversation
     * @param {Object} [options.metadata={}] - Initial metadata for Conversation
     * @return {layer.Conversation}
     */

  }, {
    key: 'create',
    value: function create(options) {
      if (!options.client) throw new Error(LayerError.dictionary.clientMissing);
      var newOptions = {
        distinct: options.distinct,
        participants: options.client._fixIdentities(options.participants),
        metadata: options.metadata,
        client: options.client
      };
      if (newOptions.distinct) {
        var conv = this._createDistinct(newOptions);
        if (conv) return conv;
      }
      return new Conversation(newOptions);
    }

    /**
     * Create or Find a Distinct Conversation.
     *
     * If the static Conversation.create method gets a request for a Distinct Conversation,
     * see if we have one cached.
     *
     * Will fire the 'conversations:loaded' event if one is provided in this call,
     * and a Conversation is found.
     *
     * @method _createDistinct
     * @static
     * @private
     * @param  {Object} options - See layer.Conversation.create options; participants must be layer.Identity[]
     * @return {layer.Conversation}
     */

  }, {
    key: '_createDistinct',
    value: function _createDistinct(options) {
      if (options.participants.indexOf(options.client.user) === -1) {
        options.participants.push(options.client.user);
      }

      var participantsHash = {};
      options.participants.forEach(function (participant) {
        participantsHash[participant.id] = participant;
      });

      var conv = options.client.findCachedConversation(function (aConv) {
        if (aConv.distinct && aConv.participants.length === options.participants.length) {
          for (var index = 0; index < aConv.participants.length; index++) {
            if (!participantsHash[aConv.participants[index].id]) return false;
          }
          return true;
        }
      });

      if (conv) {
        conv._sendDistinctEvent = new LayerEvent({
          target: conv,
          result: !options.metadata || Util.doesObjectMatch(options.metadata, conv.metadata) ? Conversation.FOUND : Conversation.FOUND_WITHOUT_REQUESTED_METADATA
        }, 'conversations:sent');
        return conv;
      }
    }

    /**
     * Identifies whether a Conversation receiving the specified patch data should be loaded from the server.
     *
     * Any change to a Conversation indicates that the Conversation is active and of potential interest; go ahead and load that
     * Conversation in case the app has need of it.  In the future we may ignore changes to unread count.  Only relevant
     * when we get Websocket events for a Conversation that has not been loaded/cached on Client.
     *
     * @method _loadResourceForPatch
     * @static
     * @private
     */

  }, {
    key: '_loadResourceForPatch',
    value: function _loadResourceForPatch(patchData) {
      return true;
    }
  }]);

  return Conversation;
}(Syncable);

/**
 * Array of participant ids.
 *
 * Do not directly manipulate;
 * use addParticipants, removeParticipants and replaceParticipants
 * to manipulate the array.
 *
 * @type {layer.Identity[]}
 */


Conversation.prototype.participants = null;

/**
 * Time that the conversation was created on the server.
 *
 * @type {Date}
 */
Conversation.prototype.createdAt = null;

/**
 * Number of unread messages in the conversation.
 *
 * @type {number}
 */
Conversation.prototype.unreadCount = 0;

/**
 * This is a Distinct Conversation.
 *
 * You can have 1 distinct conversation among a set of participants.
 * There are no limits to how many non-distinct Conversations you have have
 * among a set of participants.
 *
 * @type {boolean}
 */
Conversation.prototype.distinct = true;

/**
 * Metadata for the conversation.
 *
 * Metadata values can be plain objects and strings, but
 * no arrays, numbers, booleans or dates.
 * @type {Object}
 */
Conversation.prototype.metadata = null;

/**
 * The authenticated user is a current participant in this Conversation.
 *
 * Set to false if the authenticated user has been removed from this conversation.
 *
 * A removed user can see messages up to the time they were removed,
 * but can no longer interact with the conversation.
 *
 * A removed user can no longer see the participant list.
 *
 * Read and Delivery receipts will fail on any Message in such a Conversation.
 *
 * @type {Boolean}
 */
Conversation.prototype.isCurrentParticipant = true;

/**
 * The last layer.Message to be sent/received for this Conversation.
 *
 * Value may be a Message that has been locally created but not yet received by server.
 * @type {layer.Message}
 */
Conversation.prototype.lastMessage = null;

/**
 * Caches last result of toObject()
 * @type {Object}
 * @private
 */
Conversation.prototype._toObject = null;

Conversation.eventPrefix = 'conversations';

/**
 * Cache's a Distinct Event.
 *
 * On creating a Distinct Conversation that already exists,
 * when the send() method is called, we should trigger
 * specific events detailing the results.  Results
 * may be determined locally or on the server, but same Event may be needed.
 *
 * @type {layer.LayerEvent}
 * @private
 */
Conversation.prototype._sendDistinctEvent = null;

/**
 * Prefix to use when generating an ID for instances of this class
 * @type {String}
 * @static
 * @private
 */
Conversation.prefixUUID = 'layer:///conversations/';

/**
 * Property to look for when bubbling up events.
 * @type {String}
 * @static
 * @private
 */
Conversation.bubbleEventParent = 'getClient';

/**
 * The Conversation that was requested has been created.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.CREATED = 'Created';

/**
 * The Conversation that was requested has been found.
 *
 * This means that it did not need to be created.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.FOUND = 'Found';

/**
 * The Conversation that was requested has been found, but there was a mismatch in metadata.
 *
 * If the createConversation request contained metadata and it did not match the Distinct Conversation
 * that matched the requested participants, then this value is passed to notify your app that the Conversation
 * was returned but does not exactly match your request.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.FOUND_WITHOUT_REQUESTED_METADATA = 'FoundMismatch';

Conversation._supportedEvents = [

/**
 * The conversation is now on the server.
 *
 * Called after successfully creating the conversation
 * on the server.  The Result property is one of:
 *
 * * Conversation.CREATED: A new Conversation has been created
 * * Conversation.FOUND: A matching Distinct Conversation has been found
 * * Conversation.FOUND_WITHOUT_REQUESTED_METADATA: A matching Distinct Conversation has been found
 *                       but note that the metadata is NOT what you requested.
 *
 * All of these results will also mean that the updated property values have been
 * copied into your Conversation object.  That means your metadata property may no
 * longer be its initial value; it may be the value found on the server.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {string} event.result
 */
'conversations:sent',

/**
 * An attempt to send this conversation to the server has failed.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'conversations:sent-error',

/**
 * The conversation is now loaded from the server.
 *
 * Note that this is only used in response to the layer.Conversation.load() method.
 * from the server.
 * @event
 * @param {layer.LayerEvent} event
 */
'conversations:loaded',

/**
 * An attempt to load this conversation from the server has failed.
 *
 * Note that this is only used in response to the layer.Conversation.load() method.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'conversations:loaded-error',

/**
 * The conversation has been deleted from the server.
 *
 * Caused by either a successful call to delete() on this instance
 * or by a remote user.
 * @event
 * @param {layer.LayerEvent} event
 */
'conversations:delete',

/**
 * This conversation has changed.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {Object[]} event.changes - Array of changes reported by this event
 * @param {Mixed} event.changes.newValue
 * @param {Mixed} event.changes.oldValue
 * @param {string} event.changes.property - Name of the property that changed
 * @param {layer.Conversation} event.target
 */
'conversations:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Conversation, [Conversation, 'Conversation']);
Syncable.subclasses.push(Conversation);
module.exports = Conversation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb252ZXJzYXRpb24uanMiXSwibmFtZXMiOlsiU3luY2FibGUiLCJyZXF1aXJlIiwiTWVzc2FnZSIsIkxheWVyRXJyb3IiLCJVdGlsIiwiQ29uc3RhbnRzIiwiUm9vdCIsIkxheWVyRXZlbnQiLCJDb252ZXJzYXRpb24iLCJvcHRpb25zIiwicGFydGljaXBhbnRzIiwibWV0YWRhdGEiLCJmcm9tU2VydmVyIiwiaWQiLCJjbGllbnQiLCJjbGllbnRJZCIsImFwcElkIiwiaXNJbml0aWFsaXppbmciLCJnZXRDbGllbnQiLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwiX2ZpeElkZW50aXRpZXMiLCJpbmRleE9mIiwidXNlciIsInB1c2giLCJjcmVhdGVkQXQiLCJEYXRlIiwiX2FkZENvbnZlcnNhdGlvbiIsImxhc3RNZXNzYWdlIiwiX3JlbW92ZUNvbnZlcnNhdGlvbiIsIm1lc3NhZ2UiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwid2FzTG9jYWxEaXN0aW5jdCIsIkJvb2xlYW4iLCJfc2VuZERpc3RpbmN0RXZlbnQiLCJfaGFuZGxlTG9jYWxEaXN0aW5jdENvbnZlcnNhdGlvbiIsInBvc2l0aW9uIiwibm93Iiwic2VudEF0IiwiZ2V0VGltZSIsInN5bmNTdGF0ZSIsIlNZTkNfU1RBVEUiLCJORVciLCJsZW5ndGgiLCJtb3JlUGFydGljaXBhbnRzUmVxdWlyZWQiLCJfc2V0U3luY2luZyIsInNlbmRTb2NrZXRSZXF1ZXN0IiwibWV0aG9kIiwiYm9keSIsInN5bmMiLCJkZXBlbmRzIiwidGFyZ2V0IiwicmVzdWx0IiwiX2NyZWF0ZVJlc3VsdCIsImV2dCIsIl90cmlnZ2VyQXN5bmMiLCJkYXRhIiwiaXNNZXRhZGF0YUVtcHR5IiwiaXNFbXB0eSIsIm1hcCIsImlkZW50aXR5IiwiZGlzdGluY3QiLCJzdWNjZXNzIiwiaXNEZXN0cm95ZWQiLCJfY3JlYXRlU3VjY2VzcyIsIkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBIiwidHJpZ2dlciIsImVycm9yIiwiZGVzdHJveSIsIkNSRUFURUQiLCJGT1VORCIsImNvbnZlcnNhdGlvbiIsIl9kaXNhYmxlRXZlbnRzIiwiX3NldFN5bmNlZCIsIl91cGRhdGVDb252ZXJzYXRpb25JZCIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJwcm9wZXJ0eSIsInVybCIsImNyZWF0ZWRfYXQiLCJ1bnJlYWRDb3VudCIsInVucmVhZF9tZXNzYWdlX2NvdW50IiwiaXNDdXJyZW50UGFydGljaXBhbnQiLCJsYXN0X21lc3NhZ2UiLCJnZXRNZXNzYWdlIiwiX2NyZWF0ZU9iamVjdCIsImlkZW50aXRpZXMiLCJhZGRpbmciLCJmaWx0ZXIiLCJfcGF0Y2hQYXJ0aWNpcGFudHMiLCJhZGQiLCJyZW1vdmUiLCJjdXJyZW50UGFydGljaXBhbnRzIiwiZm9yRWFjaCIsInBhcnRpY2lwYW50IiwicmVtb3ZpbmciLCJjaGFuZ2UiLCJfZ2V0UGFydGljaXBhbnRDaGFuZ2UiLCJfYXBwbHlQYXJ0aWNpcGFudENoYW5nZSIsIm9wcyIsIm9wZXJhdGlvbiIsIl94aHIiLCJKU09OIiwic3RyaW5naWZ5IiwiaGVhZGVycyIsIl9sb2FkIiwiY29uY2F0IiwiaW5kZXgiLCJzcGxpY2UiLCJfZGVsZXRlIiwiREVMRVRJT05fTU9ERSIsIk1ZX0RFVklDRVMiLCJtb2RlIiwicXVlcnlTdHIiLCJBTEwiLCJkZWxldGlvbk1vZGVVbnN1cHBvcnRlZCIsImxvYWQiLCJfZGVsZXRlZCIsImZyb21fcG9zaXRpb24iLCJfcHVyZ2VNZXNzYWdlc0J5UG9zaXRpb24iLCJtZXNzYWdlQ29uZmlnIiwicGFydHMiLCJtaW1lVHlwZSIsImNvbnZlcnNhdGlvbklkIiwicGF0aHMiLCJfaW5MYXllclBhcnNlciIsImV2ZW50cyIsIl9fdXBkYXRlTWV0YWRhdGEiLCJnZXRJZGVudGl0eSIsIl9fdXBkYXRlUGFydGljaXBhbnRzIiwiZXJyIiwicHJvcHMiLCJsYXllclBhdGNoT3BlcmF0aW9ucyIsIk9iamVjdCIsImtleXMiLCJmdWxsTmFtZSIsIm5hbWUiLCJ2YWx1ZSIsImxheWVyUGFyc2UiLCJvYmplY3QiLCJ0eXBlIiwib3BlcmF0aW9ucyIsImNhbGxiYWNrIiwiY29udGV4dCIsImhhc0xvYWRlZEV2dCIsImlzTG9hZGluZyIsImNhbGxOb3ciLCJkZWZlciIsImFwcGx5IiwiX29sZFVucmVhZENvdW50IiwidW5kZWZpbmVkIiwiX3VwZGF0ZVVucmVhZENvdW50VGltZW91dCIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJfdXBkYXRlVW5yZWFkQ291bnRFdmVudCIsIl9fdW5yZWFkQ291bnQiLCJfdG9PYmplY3QiLCJjbG9uZSIsImV2dE5hbWUiLCJhcmdzIiwiX2NsZWFyT2JqZWN0IiwiX2Zyb21EQiIsIm5ld09wdGlvbnMiLCJjb252IiwiX2NyZWF0ZURpc3RpbmN0IiwicGFydGljaXBhbnRzSGFzaCIsImZpbmRDYWNoZWRDb252ZXJzYXRpb24iLCJhQ29udiIsImRvZXNPYmplY3RNYXRjaCIsInBhdGNoRGF0YSIsInByb3RvdHlwZSIsImV2ZW50UHJlZml4IiwicHJlZml4VVVJRCIsImJ1YmJsZUV2ZW50UGFyZW50IiwiX3N1cHBvcnRlZEV2ZW50cyIsImluaXRDbGFzcyIsInN1YmNsYXNzZXMiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0RBLElBQU1BLFdBQVdDLFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU1DLFVBQVVELFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU1FLGFBQWFGLFFBQVEsZUFBUixDQUFuQjtBQUNBLElBQU1HLE9BQU9ILFFBQVEsZ0JBQVIsQ0FBYjtBQUNBLElBQU1JLFlBQVlKLFFBQVEsU0FBUixDQUFsQjtBQUNBLElBQU1LLE9BQU9MLFFBQVEsUUFBUixDQUFiO0FBQ0EsSUFBTU0sYUFBYU4sUUFBUSxlQUFSLENBQW5COztJQUVNTyxZOzs7QUFFSjs7Ozs7Ozs7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OztBQStEOUI7Ozs7Ozs7Ozs7O0FBV0Esc0JBMUU4QixFQTBFTnBFLE1BMUVNLENBMEVDM0csU0FBUytLLGdCQTFFVixDQUFoQzs7QUE0RUF6SyxLQUFLMEssU0FBTCxDQUFlM0IsS0FBZixDQUFxQjdJLFlBQXJCLEVBQW1DLENBQUNBLFlBQUQsRUFBZSxjQUFmLENBQW5DO0FBQ0FSLFNBQVNpTCxVQUFULENBQW9CMUosSUFBcEIsQ0FBeUJmLFlBQXpCO0FBQ0EwSyxPQUFPQyxPQUFQLEdBQWlCM0ssWUFBakIiLCJmaWxlIjoiY29udmVyc2F0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIENvbnZlcnNhdGlvbiBvYmplY3QgcmVwcmVzZW50cyBhIGRpYWxvZyBhbW9uZ3N0IGEgc2V0XG4gKiBvZiBwYXJ0aWNpcGFudHMuXG4gKlxuICogQ3JlYXRlIGEgQ29udmVyc2F0aW9uIHVzaW5nIHRoZSBjbGllbnQ6XG4gKlxuICogICAgICB2YXIgY29udmVyc2F0aW9uID0gY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gKiAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsJ2InXSxcbiAqICAgICAgICAgIGRpc3RpbmN0OiB0cnVlXG4gKiAgICAgIH0pO1xuICpcbiAqIE5PVEU6ICAgRG8gbm90IGNyZWF0ZSBhIGNvbnZlcnNhdGlvbiB3aXRoIG5ldyBsYXllci5Db252ZXJzYXRpb24oLi4uKSxcbiAqICAgICAgICAgVGhpcyB3aWxsIGZhaWwgdG8gaGFuZGxlIHRoZSBkaXN0aW5jdCBwcm9wZXJ0eSBzaG9ydCBvZiBnb2luZyB0byB0aGUgc2VydmVyIGZvciBldmFsdWF0aW9uLlxuICpcbiAqIE5PVEU6ICAgQ3JlYXRpbmcgYSBDb252ZXJzYXRpb24gaXMgYSBsb2NhbCBhY3Rpb24uICBBIENvbnZlcnNhdGlvbiB3aWxsIG5vdCBiZVxuICogICAgICAgICBzZW50IHRvIHRoZSBzZXJ2ZXIgdW50aWwgZWl0aGVyOlxuICpcbiAqIDEuIEEgbWVzc2FnZSBpcyBzZW50IG9uIHRoYXQgQ29udmVyc2F0aW9uXG4gKiAyLiBgQ29udmVyc2F0aW9uLnNlbmQoKWAgaXMgY2FsbGVkIChub3QgcmVjb21tZW5kZWQgYXMgbW9iaWxlIGNsaWVudHNcbiAqICAgIGV4cGVjdCBhdCBsZWFzdCBvbmUgbGF5ZXIuTWVzc2FnZSBpbiBhIENvbnZlcnNhdGlvbilcbiAqXG4gKiBLZXkgbWV0aG9kcywgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIGZvciBnZXR0aW5nIHN0YXJ0ZWQ6XG4gKlxuICogUHJvcGVydGllczpcbiAqXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5pZDogdGhpcyBwcm9wZXJ0eSBpcyB3b3J0aCBiZWluZyBmYW1pbGlhciB3aXRoOyBpdCBpZGVudGlmaWVzIHRoZVxuICogICBDb252ZXJzYXRpb24gYW5kIGNhbiBiZSB1c2VkIGluIGBjbGllbnQuZ2V0Q29udmVyc2F0aW9uKGlkKWAgdG8gcmV0cmlldmUgaXQuXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZTogVGhpcyBwcm9wZXJ0eSBtYWtlcyBpdCBlYXN5IHRvIHNob3cgaW5mbyBhYm91dCB0aGUgbW9zdCByZWNlbnQgTWVzc2FnZVxuICogICAgd2hlbiByZW5kZXJpbmcgYSBsaXN0IG9mIENvbnZlcnNhdGlvbnMuXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5tZXRhZGF0YTogQ3VzdG9tIGRhdGEgZm9yIHlvdXIgQ29udmVyc2F0aW9uOyBjb21tb25seSB1c2VkIHRvIHN0b3JlIGEgJ3RpdGxlJyBwcm9wZXJ0eVxuICogICAgdG8gbmFtZSB5b3VyIENvbnZlcnNhdGlvbi5cbiAqXG4gKiBNZXRob2RzOlxuICpcbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLmFkZFBhcnRpY2lwYW50cyBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLnJlbW92ZVBhcnRpY2lwYW50czogQ2hhbmdlIHRoZSBwYXJ0aWNpcGFudHMgb2YgdGhlIENvbnZlcnNhdGlvblxuICogKiBsYXllci5Db252ZXJzYXRpb24uc2V0TWV0YWRhdGFQcm9wZXJ0aWVzOiBTZXQgbWV0YWRhdGEudGl0bGUgdG8gJ015IENvbnZlcnNhdGlvbiB3aXRoIExheWVyIFN1cHBvcnQnICh1aCBvaClcbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLm9uKCkgYW5kIGxheWVyLkNvbnZlcnNhdGlvbi5vZmYoKTogZXZlbnQgbGlzdGVuZXJzIGJ1aWx0IG9uIHRvcCBvZiB0aGUgYGJhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lYCBucG0gcHJvamVjdFxuICogKiBsYXllci5Db252ZXJzYXRpb24ubGVhdmUoKSB0byBsZWF2ZSB0aGUgQ29udmVyc2F0aW9uXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5kZWxldGUoKSB0byBkZWxldGUgdGhlIENvbnZlcnNhdGlvbiBmb3IgYWxsIHVzZXJzIChvciBmb3IganVzdCB0aGlzIHVzZXIpXG4gKlxuICogRXZlbnRzOlxuICpcbiAqICogYGNvbnZlcnNhdGlvbnM6Y2hhbmdlYDogVXNlZnVsIGZvciBvYnNlcnZpbmcgY2hhbmdlcyB0byBwYXJ0aWNpcGFudHMgYW5kIG1ldGFkYXRhXG4gKiAgIGFuZCB1cGRhdGluZyByZW5kZXJpbmcgb2YgeW91ciBvcGVuIENvbnZlcnNhdGlvblxuICpcbiAqIEZpbmFsbHksIHRvIGFjY2VzcyBhIGxpc3Qgb2YgTWVzc2FnZXMgaW4gYSBDb252ZXJzYXRpb24sIHNlZSBsYXllci5RdWVyeS5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNvbnZlcnNhdGlvblxuICogQGV4dGVuZHMgbGF5ZXIuU3luY2FibGVcbiAqIEBhdXRob3IgIE1pY2hhZWwgS2FudG9yXG4gKi9cblxuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBNZXNzYWdlID0gcmVxdWlyZSgnLi9tZXNzYWdlJyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBMYXllckV2ZW50ID0gcmVxdWlyZSgnLi9sYXllci1ldmVudCcpO1xuXG5jbGFzcyBDb252ZXJzYXRpb24gZXh0ZW5kcyBTeW5jYWJsZSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqIFRoZSBzdGF0aWMgYGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoKWAgbWV0aG9kXG4gICAqIHdpbGwgY29ycmVjdGx5IGxvb2t1cCBkaXN0aW5jdCBDb252ZXJzYXRpb25zIGFuZFxuICAgKiByZXR1cm4gdGhlbTsgYG5ldyBsYXllci5Db252ZXJzYXRpb24oKWAgd2lsbCBub3QuXG4gICAqXG4gICAqIERldmVsb3BlcnMgc2hvdWxkIHVzZSBgbGF5ZXIuQ29udmVyc2F0aW9uLmNyZWF0ZSgpYC5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMucGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIGxheWVyLklkZW50aXR5IGluc3RhbmNlc1xuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRpc3RpbmN0PXRydWVdIC0gSXMgdGhlIGNvbnZlcnNhdGlvbiBkaXN0aW5jdFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubWV0YWRhdGFdIC0gQW4gb2JqZWN0IGNvbnRhaW5pbmcgQ29udmVyc2F0aW9uIE1ldGFkYXRhLlxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICAvLyBTZXR1cCBkZWZhdWx0IHZhbHVlc1xuICAgIGlmICghb3B0aW9ucy5wYXJ0aWNpcGFudHMpIG9wdGlvbnMucGFydGljaXBhbnRzID0gW107XG4gICAgaWYgKCFvcHRpb25zLm1ldGFkYXRhKSBvcHRpb25zLm1ldGFkYXRhID0ge307XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlIElEIGZyb20gaGFuZGxlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyIGlzIHVzZWQgYnkgdGhlIFJvb3QuY29uc3RydWN0b3JcbiAgICBpZiAob3B0aW9ucy5mcm9tU2VydmVyKSBvcHRpb25zLmlkID0gb3B0aW9ucy5mcm9tU2VydmVyLmlkO1xuXG4gICAgLy8gTWFrZSBzdXJlIHdlIGhhdmUgYW4gY2xpZW50SWQgcHJvcGVydHlcbiAgICBpZiAob3B0aW9ucy5jbGllbnQpIG9wdGlvbnMuY2xpZW50SWQgPSBvcHRpb25zLmNsaWVudC5hcHBJZDtcblxuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gSWYgdGhlIG9wdGlvbnMgY29udGFpbnMgYSBmdWxsIHNlcnZlciBkZWZpbml0aW9uIG9mIHRoZSBvYmplY3QsXG4gICAgLy8gY29weSBpdCBpbiB3aXRoIF9wb3B1bGF0ZUZyb21TZXJ2ZXI7IHRoaXMgd2lsbCBhZGQgdGhlIENvbnZlcnNhdGlvblxuICAgIC8vIHRvIHRoZSBDbGllbnQgYXMgd2VsbC5cbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihvcHRpb25zLmZyb21TZXJ2ZXIpO1xuICAgIH1cblxuICAgIC8vIFNldHVwIHBhcnRpY2lwYW50c1xuICAgIGVsc2Uge1xuICAgICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXModGhpcy5wYXJ0aWNpcGFudHMpO1xuXG4gICAgICBpZiAodGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZihjbGllbnQudXNlcikgPT09IC0xKSB7XG4gICAgICAgIHRoaXMucGFydGljaXBhbnRzLnB1c2goY2xpZW50LnVzZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdGhpcy5jcmVhdGVkQXQpIHtcbiAgICAgIHRoaXMuY3JlYXRlZEF0ID0gbmV3IERhdGUoKTtcbiAgICB9XG5cbiAgICBjbGllbnQuX2FkZENvbnZlcnNhdGlvbih0aGlzKTtcbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgbG9jYWwgY29weSBvZiB0aGlzIENvbnZlcnNhdGlvbiwgY2xlYW5pbmcgdXAgYWxsIHJlc291cmNlc1xuICAgKiBpdCBjb25zdW1lcy5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMubGFzdE1lc3NhZ2UgPSBudWxsO1xuXG4gICAgLy8gQ2xpZW50IGZpcmVzICdjb252ZXJzYXRpb25zOnJlbW92ZScgYW5kIHRoZW4gcmVtb3ZlcyB0aGUgQ29udmVyc2F0aW9uLlxuICAgIGlmICh0aGlzLmNsaWVudElkKSB0aGlzLmdldENsaWVudCgpLl9yZW1vdmVDb252ZXJzYXRpb24odGhpcyk7XG5cbiAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICB0aGlzLnBhcnRpY2lwYW50cyA9IG51bGw7XG4gICAgdGhpcy5tZXRhZGF0YSA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIHRoaXMgQ29udmVyc2F0aW9uIG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE9uIGNvbXBsZXRpb24sIHRoaXMgaW5zdGFuY2Ugd2lsbCByZWNlaXZlXG4gICAqIGFuIGlkLCB1cmwgYW5kIGNyZWF0ZWRBdC4gIEl0IG1heSBhbHNvIHJlY2VpdmUgbWV0YWRhdGFcbiAgICogaWYgdGhlcmUgd2FzIGEgRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEgcmVzdWx0LlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIG9wdGlvbmFsIE1lc3NhZ2UgcGFyYW1ldGVyIHNob3VsZCBOT1QgYmUgdXNlZCBleGNlcHRcbiAgICogYnkgdGhlIGxheWVyLk1lc3NhZ2UgY2xhc3MgaXRzZWxmLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgcmVjb21tZW5kZWQgcHJhY3RpY2UgaXMgdG8gc2VuZCB0aGUgQ29udmVyc2F0aW9uIGJ5IHNlbmRpbmcgYSBNZXNzYWdlIGluIHRoZSBDb252ZXJzYXRpb24sXG4gICAqIGFuZCBOT1QgYnkgY2FsbGluZyBDb252ZXJzYXRpb24uc2VuZC5cbiAgICpcbiAgICogICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAgICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddLFxuICAgKiAgICAgICAgICBkaXN0aW5jdDogZmFsc2VcbiAgICogICAgICB9KVxuICAgKiAgICAgIC5zZW5kKClcbiAgICogICAgICAub24oJ2NvbnZlcnNhdGlvbnM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBhbGVydCgnRG9uZScpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBbbWVzc2FnZV0gVGVsbHMgdGhlIENvbnZlcnNhdGlvbiB3aGF0IGl0cyBsYXN0X21lc3NhZ2Ugd2lsbCBiZVxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIHNlbmQobWVzc2FnZSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFjbGllbnQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG5cbiAgICAvLyBJZiB0aGlzIGlzIHBhcnQgb2YgYSBjcmVhdGUoe2Rpc3RpbmN0OnRydWV9KS5zZW5kKCkgY2FsbCB3aGVyZVxuICAgIC8vIHRoZSBkaXN0aW5jdCBjb252ZXJzYXRpb24gd2FzIGZvdW5kLCBqdXN0IHRyaWdnZXIgdGhlIGNhY2hlZCBldmVudCBhbmQgZXhpdFxuICAgIGNvbnN0IHdhc0xvY2FsRGlzdGluY3QgPSBCb29sZWFuKHRoaXMuX3NlbmREaXN0aW5jdEV2ZW50KTtcbiAgICBpZiAodGhpcy5fc2VuZERpc3RpbmN0RXZlbnQpIHRoaXMuX2hhbmRsZUxvY2FsRGlzdGluY3RDb252ZXJzYXRpb24oKTtcblxuICAgIC8vIElmIGEgbWVzc2FnZSBpcyBwYXNzZWQgaW4sIHRoZW4gdGhhdCBtZXNzYWdlIGlzIGJlaW5nIHNlbnQsIGFuZCBpcyBvdXJcbiAgICAvLyBuZXcgbGFzdE1lc3NhZ2UgKHVudGlsIHRoZSB3ZWJzb2NrZXQgdGVsbHMgdXMgb3RoZXJ3aXNlKVxuICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAvLyBTZXR0aW5nIGEgcG9zaXRpb24gaXMgcmVxdWlyZWQgaWYgaXRzIGdvaW5nIHRvIGdldCBzb3J0ZWQgY29ycmVjdGx5IGJ5IHF1ZXJ5LlxuICAgICAgLy8gVGhlIGNvcnJlY3QgcG9zaXRpb24gd2lsbCBiZSB3cml0dGVuIGJ5IF9wb3B1bGF0ZUZyb21TZXJ2ZXIgd2hlbiB0aGUgb2JqZWN0XG4gICAgICAvLyBpcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXIuICBXZSBpbmNyZW1lbnQgdGhlIHBvc2l0aW9uIGJ5IHRoZSB0aW1lIHNpbmNlIHRoZSBwcmlvciBsYXN0TWVzc2FnZSB3YXMgc2VudFxuICAgICAgLy8gc28gdGhhdCBpZiBtdWx0aXBsZSB0YWJzIGFyZSBzZW5kaW5nIG1lc3NhZ2VzIGFuZCB3cml0aW5nIHRoZW0gdG8gaW5kZXhlZERCLCB0aGV5IHdpbGwgaGF2ZSBwb3NpdGlvbnMgaW4gY29ycmVjdCBjaHJvbm9sb2dpY2FsIG9yZGVyLlxuICAgICAgLy8gV0FSTklORzogVGhlIHF1ZXJ5IHdpbGwgTk9UIGJlIHJlc29ydGVkIHVzaW5nIHRoZSBzZXJ2ZXIncyBwb3NpdGlvbiB2YWx1ZS5cbiAgICAgIGxldCBwb3NpdGlvbjtcbiAgICAgIGlmICh0aGlzLmxhc3RNZXNzYWdlKSB7XG4gICAgICAgIHBvc2l0aW9uID0gdGhpcy5sYXN0TWVzc2FnZS5wb3NpdGlvbiArIERhdGUubm93KCkgLSB0aGlzLmxhc3RNZXNzYWdlLnNlbnRBdC5nZXRUaW1lKCk7XG4gICAgICAgIGlmIChwb3NpdGlvbiA9PT0gdGhpcy5sYXN0TWVzc2FnZS5wb3NpdGlvbikgcG9zaXRpb24rKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBvc2l0aW9uID0gMDtcbiAgICAgIH1cbiAgICAgIG1lc3NhZ2UucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgIHRoaXMubGFzdE1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBDb252ZXJzYXRpb24gaXMgYWxyZWFkeSBvbiB0aGUgc2VydmVyLCBkb24ndCBzZW5kLlxuICAgIGlmICh3YXNMb2NhbERpc3RpbmN0IHx8IHRoaXMuc3luY1N0YXRlICE9PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpIHJldHVybiB0aGlzO1xuXG4gICAgLy8gTWFrZSBzdXJlIHRoaXMgdXNlciBpcyBhIHBhcnRpY2lwYW50IChzZXJ2ZXIgZG9lcyB0aGlzIGZvciB1cywgYnV0XG4gICAgLy8gdGhpcyBpbnN1cmVzIHRoZSBsb2NhbCBjb3B5IGlzIGNvcnJlY3QgdW50aWwgd2UgZ2V0IGEgcmVzcG9uc2UgZnJvbVxuICAgIC8vIHRoZSBzZXJ2ZXJcbiAgICBpZiAodGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZihjbGllbnQudXNlcikgPT09IC0xKSB7XG4gICAgICB0aGlzLnBhcnRpY2lwYW50cy5wdXNoKGNsaWVudC51c2VyKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBvbmx5IG9uZSBwYXJ0aWNpcGFudCwgaXRzIGNsaWVudC51c2VyLnVzZXJJZC4gIE5vdCBlbm91Z2hcbiAgICAvLyBmb3IgdXMgdG8gaGF2ZSBhIGdvb2QgQ29udmVyc2F0aW9uIG9uIHRoZSBzZXJ2ZXIuICBBYm9ydC5cbiAgICBpZiAodGhpcy5wYXJ0aWNpcGFudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5Lm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGVkQXQgPSBuZXcgRGF0ZSgpO1xuXG4gICAgLy8gVXBkYXRlIHRoZSBzeW5jU3RhdGVcbiAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG5cbiAgICBjbGllbnQuc2VuZFNvY2tldFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiB7fSwgLy8gc2VlIF9nZXRTZW5kRGF0YVxuICAgICAgc3luYzoge1xuICAgICAgICBkZXBlbmRzOiB0aGlzLmlkLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuaWQsXG4gICAgICB9LFxuICAgIH0sIChyZXN1bHQpID0+IHRoaXMuX2NyZWF0ZVJlc3VsdChyZXN1bHQpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIHRoZSBjYXNlIHdoZXJlIGEgRGlzdGluY3QgQ3JlYXRlIENvbnZlcnNhdGlvbiBmb3VuZCBhIGxvY2FsIG1hdGNoLlxuICAgKlxuICAgKiBXaGVuIGFuIGFwcCBjYWxscyBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKFsuLi5dKVxuICAgKiBhbmQgcmVxdWVzdHMgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24gKGRlZmF1bHQgc2V0dGluZyksXG4gICAqIGFuZCB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzLCB3aGF0IGRvIHdlIGRvIHRvIGhlbHBcbiAgICogdGhlbSBhY2Nlc3MgaXQ/XG4gICAqXG4gICAqICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbihbXCJmcmVkXCJdKS5vbihcImNvbnZlcnNhdGlvbnM6c2VudFwiLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgIHJlbmRlcigpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBVbmRlciBub3JtYWwgY29uZGl0aW9ucywgY2FsbGluZyBgYy5zZW5kKClgIG9uIGEgbWF0Y2hpbmcgZGlzdGluY3QgQ29udmVyc2F0aW9uXG4gICAqIHdvdWxkIGVpdGhlciB0aHJvdyBhbiBlcnJvciBvciBqdXN0IGJlIGEgbm8tb3AuICBXZSB1c2UgdGhpcyBtZXRob2QgdG8gdHJpZ2dlclxuICAgKiB0aGUgZXhwZWN0ZWQgXCJjb252ZXJzYXRpb25zOnNlbnRcIiBldmVudCBldmVuIHRob3VnaCBpdHMgYWxyZWFkeSBiZWVuIHNlbnQgYW5kXG4gICAqIHdlIGRpZCBub3RoaW5nLiAgVXNlIHRoZSBldnQucmVzdWx0IHByb3BlcnR5IGlmIHlvdSB3YW50IHRvIGtub3cgd2hldGhlciB0aGVcbiAgICogcmVzdWx0IHdhcyBhIG5ldyBjb252ZXJzYXRpb24gb3IgbWF0Y2hpbmcgb25lLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVMb2NhbERpc3RpbmN0Q29udmVyc2F0aW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFuZGxlTG9jYWxEaXN0aW5jdENvbnZlcnNhdGlvbigpIHtcbiAgICBjb25zdCBldnQgPSB0aGlzLl9zZW5kRGlzdGluY3RFdmVudDtcbiAgICB0aGlzLl9zZW5kRGlzdGluY3RFdmVudCA9IG51bGw7XG5cbiAgICAvLyBkZWxheSBzbyB0aGVyZSBpcyB0aW1lIHRvIHNldHVwIGFuIGV2ZW50IGxpc3RlbmVyIG9uIHRoaXMgY29udmVyc2F0aW9uXG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOnNlbnQnLCBldnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICAvKipcbiAgICogR2V0cyB0aGUgZGF0YSBmb3IgYSBDcmVhdGUgcmVxdWVzdC5cbiAgICpcbiAgICogVGhlIGxheWVyLlN5bmNNYW5hZ2VyIG5lZWRzIGEgY2FsbGJhY2sgdG8gY3JlYXRlIHRoZSBDb252ZXJzYXRpb24gYXMgaXRcbiAgICogbG9va3MgTk9XLCBub3QgYmFjayB3aGVuIGBzZW5kKClgIHdhcyBjYWxsZWQuICBUaGlzIG1ldGhvZCBpcyBjYWxsZWRcbiAgICogYnkgdGhlIGxheWVyLlN5bmNNYW5hZ2VyIHRvIHBvcHVsYXRlIHRoZSBQT1NUIGRhdGEgb2YgdGhlIGNhbGwuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFNlbmREYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge09iamVjdH0gV2Vic29ja2V0IGRhdGEgZm9yIHRoZSByZXF1ZXN0XG4gICAqL1xuICBfZ2V0U2VuZERhdGEoZGF0YSkge1xuICAgIGNvbnN0IGlzTWV0YWRhdGFFbXB0eSA9IFV0aWwuaXNFbXB0eSh0aGlzLm1ldGFkYXRhKTtcbiAgICByZXR1cm4ge1xuICAgICAgbWV0aG9kOiAnQ29udmVyc2F0aW9uLmNyZWF0ZScsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHBhcnRpY2lwYW50czogdGhpcy5wYXJ0aWNpcGFudHMubWFwKGlkZW50aXR5ID0+IGlkZW50aXR5LmlkKSxcbiAgICAgICAgZGlzdGluY3Q6IHRoaXMuZGlzdGluY3QsXG4gICAgICAgIG1ldGFkYXRhOiBpc01ldGFkYXRhRW1wdHkgPyBudWxsIDogdGhpcy5tZXRhZGF0YSxcbiAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyByZXN1bHQgb2Ygc2VuZCBtZXRob2QuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB3ZSB1c2UgX3RyaWdnZXJBc3luYyBzbyB0aGF0XG4gICAqIGV2ZW50cyByZXBvcnRpbmcgY2hhbmdlcyB0byB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmlkIGNhblxuICAgKiBiZSBhcHBsaWVkIGJlZm9yZSByZXBvcnRpbmcgb24gaXQgYmVpbmcgc2VudC5cbiAgICpcbiAgICogRXhhbXBsZTogUXVlcnkgd2lsbCBub3cgaGF2ZSB0aGUgcmVzb2x2ZWQgRGlzdGluY3QgSURzIHJhdGhlciB0aGFuIHRoZSBwcm9wb3NlZCBJRFxuICAgKiB3aGVuIHRoaXMgZXZlbnQgaXMgdHJpZ2dlcmVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICovXG4gIF9jcmVhdGVSZXN1bHQoeyBzdWNjZXNzLCBkYXRhIH0pIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICB0aGlzLl9jcmVhdGVTdWNjZXNzKGRhdGEpO1xuICAgIH0gZWxzZSBpZiAoZGF0YS5pZCA9PT0gJ2NvbmZsaWN0Jykge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKGRhdGEuZGF0YSk7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6c2VudCcsIHtcbiAgICAgICAgcmVzdWx0OiBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50cmlnZ2VyKCdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLCB7IGVycm9yOiBkYXRhIH0pO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIHN1Y2Nlc3NmdWwgcmVzdWx0IG9mIGEgY3JlYXRlIGNhbGxcbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlU3VjY2Vzc1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgU2VydmVyIGRlc2NyaXB0aW9uIG9mIENvbnZlcnNhdGlvblxuICAgKi9cbiAgX2NyZWF0ZVN1Y2Nlc3MoZGF0YSkge1xuICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihkYXRhKTtcbiAgICBpZiAoIXRoaXMuZGlzdGluY3QpIHtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpzZW50Jywge1xuICAgICAgICByZXN1bHQ6IENvbnZlcnNhdGlvbi5DUkVBVEVELFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEN1cnJlbnRseSB0aGUgd2Vic29ja2V0IGRvZXMgbm90IHRlbGwgdXMgaWYgaXRzXG4gICAgICAvLyByZXR1cm5pbmcgYW4gZXhpc3RpbmcgQ29udmVyc2F0aW9uLiAgU28gZ3Vlc3MuLi5cbiAgICAgIC8vIGlmIHRoZXJlIGlzIG5vIGxhc3RNZXNzYWdlLCB0aGVuIG1vc3QgbGlrZWx5LCB0aGVyZSB3YXNcbiAgICAgIC8vIG5vIGV4aXN0aW5nIENvbnZlcnNhdGlvbi4gIFNhZGx5LCBBUEktODM0OyBsYXN0X21lc3NhZ2UgaXMgY3VycmVudGx5XG4gICAgICAvLyBhbHdheXMgbnVsbC5cbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpzZW50Jywge1xuICAgICAgICByZXN1bHQ6ICF0aGlzLmxhc3RNZXNzYWdlID8gQ29udmVyc2F0aW9uLkNSRUFURUQgOiBDb252ZXJzYXRpb24uRk9VTkQsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoaXMgaW5zdGFuY2UgdXNpbmcgc2VydmVyLWRhdGEuXG4gICAqXG4gICAqIFNpZGUgZWZmZWN0cyBhZGQgdGhpcyB0byB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb252ZXJzYXRpb24gLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNvbnZlcnNhdGlvblxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihjb252ZXJzYXRpb24pIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gRGlzYWJsZSBldmVudHMgaWYgY3JlYXRpbmcgYSBuZXcgQ29udmVyc2F0aW9uXG4gICAgLy8gV2Ugc3RpbGwgd2FudCBwcm9wZXJ0eSBjaGFuZ2UgZXZlbnRzIGZvciBhbnl0aGluZyB0aGF0IERPRVMgY2hhbmdlXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9ICh0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKTtcblxuICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuXG4gICAgY29uc3QgaWQgPSB0aGlzLmlkO1xuICAgIHRoaXMuaWQgPSBjb252ZXJzYXRpb24uaWQ7XG5cbiAgICAvLyBJRHMgY2hhbmdlIGlmIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvblxuICAgIGlmIChpZCAhPT0gdGhpcy5pZCkge1xuICAgICAgY2xpZW50Ll91cGRhdGVDb252ZXJzYXRpb25JZCh0aGlzLCBpZCk7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJywge1xuICAgICAgICBvbGRWYWx1ZTogaWQsXG4gICAgICAgIG5ld1ZhbHVlOiB0aGlzLmlkLFxuICAgICAgICBwcm9wZXJ0eTogJ2lkJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMudXJsID0gY29udmVyc2F0aW9uLnVybDtcbiAgICB0aGlzLnBhcnRpY2lwYW50cyA9IGNsaWVudC5fZml4SWRlbnRpdGllcyhjb252ZXJzYXRpb24ucGFydGljaXBhbnRzKTtcbiAgICB0aGlzLmRpc3RpbmN0ID0gY29udmVyc2F0aW9uLmRpc3RpbmN0O1xuICAgIHRoaXMuY3JlYXRlZEF0ID0gbmV3IERhdGUoY29udmVyc2F0aW9uLmNyZWF0ZWRfYXQpO1xuICAgIHRoaXMubWV0YWRhdGEgPSBjb252ZXJzYXRpb24ubWV0YWRhdGE7XG4gICAgdGhpcy51bnJlYWRDb3VudCA9IGNvbnZlcnNhdGlvbi51bnJlYWRfbWVzc2FnZV9jb3VudDtcbiAgICB0aGlzLmlzQ3VycmVudFBhcnRpY2lwYW50ID0gdGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZihjbGllbnQudXNlcikgIT09IC0xO1xuXG4gICAgY2xpZW50Ll9hZGRDb252ZXJzYXRpb24odGhpcyk7XG5cbiAgICBpZiAodHlwZW9mIGNvbnZlcnNhdGlvbi5sYXN0X21lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gY2xpZW50LmdldE1lc3NhZ2UoY29udmVyc2F0aW9uLmxhc3RfbWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb24ubGFzdF9tZXNzYWdlKSB7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gY2xpZW50Ll9jcmVhdGVPYmplY3QoY29udmVyc2F0aW9uLmxhc3RfbWVzc2FnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGFzdE1lc3NhZ2UgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFkZCBhbiBhcnJheSBvZiBwYXJ0aWNpcGFudCBpZHMgdG8gdGhlIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24uYWRkUGFydGljaXBhbnRzKFsnYScsICdiJ10pO1xuICAgKlxuICAgKiBOZXcgcGFydGljaXBhbnRzIHdpbGwgaW1tZWRpYXRlbHkgc2hvdyB1cCBpbiB0aGUgQ29udmVyc2F0aW9uLFxuICAgKiBidXQgbWF5IG5vdCBoYXZlIHN5bmNlZCB3aXRoIHRoZSBzZXJ2ZXIgeWV0LlxuICAgKlxuICAgKiBUT0RPIFdFQi05Njc6IFJvbGwgcGFydGljaXBhbnRzIGJhY2sgb24gZ2V0dGluZyBhIHNlcnZlciBlcnJvclxuICAgKlxuICAgKiBAbWV0aG9kIGFkZFBhcnRpY2lwYW50c1xuICAgKiBAcGFyYW0gIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBwYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgSWRlbnRpdHkgb2JqZWN0c1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICBhZGRQYXJ0aWNpcGFudHMocGFydGljaXBhbnRzKSB7XG4gICAgLy8gT25seSBhZGQgdGhvc2UgdGhhdCBhcmVuJ3QgYWxyZWFkeSBpbiB0aGUgbGlzdC5cbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNvbnN0IGlkZW50aXRpZXMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXMocGFydGljaXBhbnRzKTtcbiAgICBjb25zdCBhZGRpbmcgPSBpZGVudGl0aWVzLmZpbHRlcihpZGVudGl0eSA9PiB0aGlzLnBhcnRpY2lwYW50cy5pbmRleE9mKGlkZW50aXR5KSA9PT0gLTEpO1xuICAgIHRoaXMuX3BhdGNoUGFydGljaXBhbnRzKHsgYWRkOiBhZGRpbmcsIHJlbW92ZTogW10gfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhbiBhcnJheSBvZiBwYXJ0aWNpcGFudCBpZHMgZnJvbSB0aGUgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5yZW1vdmVQYXJ0aWNpcGFudHMoWydhJywgJ2InXSk7XG4gICAqXG4gICAqIFJlbW92ZWQgcGFydGljaXBhbnRzIHdpbGwgaW1tZWRpYXRlbHkgYmUgcmVtb3ZlZCBmcm9tIHRoaXMgQ29udmVyc2F0aW9uLFxuICAgKiBidXQgbWF5IG5vdCBoYXZlIHN5bmNlZCB3aXRoIHRoZSBzZXJ2ZXIgeWV0LlxuICAgKlxuICAgKiBUaHJvd3MgZXJyb3IgaWYgeW91IGF0dGVtcHQgdG8gcmVtb3ZlIEFMTCBwYXJ0aWNpcGFudHMuXG4gICAqXG4gICAqIFRPRE8gIFdFQi05Njc6IFJvbGwgcGFydGljaXBhbnRzIGJhY2sgb24gZ2V0dGluZyBhIHNlcnZlciBlcnJvclxuICAgKlxuICAgKiBAbWV0aG9kIHJlbW92ZVBhcnRpY2lwYW50c1xuICAgKiBAcGFyYW0gIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBwYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgSWRlbnRpdHkgb2JqZWN0c1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICByZW1vdmVQYXJ0aWNpcGFudHMocGFydGljaXBhbnRzKSB7XG4gICAgY29uc3QgY3VycmVudFBhcnRpY2lwYW50cyA9IHt9O1xuICAgIHRoaXMucGFydGljaXBhbnRzLmZvckVhY2gocGFydGljaXBhbnQgPT4gKGN1cnJlbnRQYXJ0aWNpcGFudHNbcGFydGljaXBhbnQuaWRdID0gdHJ1ZSkpO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgY29uc3QgaWRlbnRpdGllcyA9IGNsaWVudC5fZml4SWRlbnRpdGllcyhwYXJ0aWNpcGFudHMpO1xuXG4gICAgY29uc3QgcmVtb3ZpbmcgPSBpZGVudGl0aWVzLmZpbHRlcihwYXJ0aWNpcGFudCA9PiBjdXJyZW50UGFydGljaXBhbnRzW3BhcnRpY2lwYW50LmlkXSk7XG4gICAgaWYgKHJlbW92aW5nLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXM7XG4gICAgaWYgKHJlbW92aW5nLmxlbmd0aCA9PT0gdGhpcy5wYXJ0aWNpcGFudHMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5Lm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCk7XG4gICAgfVxuICAgIHRoaXMuX3BhdGNoUGFydGljaXBhbnRzKHsgYWRkOiBbXSwgcmVtb3ZlOiByZW1vdmluZyB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYWNlcyBhbGwgcGFydGljaXBhbnRzIHdpdGggYSBuZXcgYXJyYXkgb2Ygb2YgcGFydGljaXBhbnQgaWRzLlxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5yZXBsYWNlUGFydGljaXBhbnRzKFsnYScsICdiJ10pO1xuICAgKlxuICAgKiBDaGFuZ2VkIHBhcnRpY2lwYW50cyB3aWxsIGltbWVkaWF0ZWx5IHNob3cgdXAgaW4gdGhlIENvbnZlcnNhdGlvbixcbiAgICogYnV0IG1heSBub3QgaGF2ZSBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIHlldC5cbiAgICpcbiAgICogVE9ETyBXRUItOTY3OiBSb2xsIHBhcnRpY2lwYW50cyBiYWNrIG9uIGdldHRpbmcgYSBzZXJ2ZXIgZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCByZXBsYWNlUGFydGljaXBhbnRzXG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IHBhcnRpY2lwYW50cyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBJZGVudGl0eSBvYmplY3RzXG4gICAqIEByZXR1cm5zIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIHJlcGxhY2VQYXJ0aWNpcGFudHMocGFydGljaXBhbnRzKSB7XG4gICAgaWYgKCFwYXJ0aWNpcGFudHMgfHwgIXBhcnRpY2lwYW50cy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkubW9yZVBhcnRpY2lwYW50c1JlcXVpcmVkKTtcbiAgICB9XG5cbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNvbnN0IGlkZW50aXRpZXMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXMocGFydGljaXBhbnRzKTtcblxuICAgIGNvbnN0IGNoYW5nZSA9IHRoaXMuX2dldFBhcnRpY2lwYW50Q2hhbmdlKGlkZW50aXRpZXMsIHRoaXMucGFydGljaXBhbnRzKTtcbiAgICB0aGlzLl9wYXRjaFBhcnRpY2lwYW50cyhjaGFuZ2UpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc2VydmVyIHdpdGggdGhlIG5ldyBwYXJ0aWNpcGFudCBsaXN0LlxuICAgKlxuICAgKiBFeGVjdXRlcyBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiAxLiBVcGRhdGVzIHRoZSBwYXJ0aWNpcGFudHMgcHJvcGVydHkgb2YgdGhlIGxvY2FsIG9iamVjdFxuICAgKiAyLiBUcmlnZ2VycyBhIGNvbnZlcnNhdGlvbnM6Y2hhbmdlIGV2ZW50XG4gICAqIDMuIFN1Ym1pdHMgYSByZXF1ZXN0IHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlciB0byB1cGRhdGUgdGhlIHNlcnZlcidzIG9iamVjdFxuICAgKiA0LiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgbm8gZXJyb3JzIGFyZSBmaXJlZCBleGNlcHQgYnkgbGF5ZXIuU3luY01hbmFnZXIsIGJ1dCBhbm90aGVyXG4gICAqICAgIGNvbnZlcnNhdGlvbnM6Y2hhbmdlIGV2ZW50IGlzIGZpcmVkIGFzIHRoZSBjaGFuZ2UgaXMgcm9sbGVkIGJhY2suXG4gICAqXG4gICAqIEBtZXRob2QgX3BhdGNoUGFydGljaXBhbnRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdFtdfSBvcGVyYXRpb25zIC0gQXJyYXkgb2YgSlNPTiBwYXRjaCBvcGVyYXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBldmVudERhdGEgLSBEYXRhIGRlc2NyaWJpbmcgdGhlIGNoYW5nZSBmb3IgdXNlIGluIGFuIGV2ZW50XG4gICAqL1xuICBfcGF0Y2hQYXJ0aWNpcGFudHMoY2hhbmdlKSB7XG4gICAgdGhpcy5fYXBwbHlQYXJ0aWNpcGFudENoYW5nZShjaGFuZ2UpO1xuICAgIHRoaXMuaXNDdXJyZW50UGFydGljaXBhbnQgPSB0aGlzLnBhcnRpY2lwYW50cy5pbmRleE9mKHRoaXMuZ2V0Q2xpZW50KCkudXNlcikgIT09IC0xO1xuXG4gICAgY29uc3Qgb3BzID0gW107XG4gICAgY2hhbmdlLnJlbW92ZS5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IHtcbiAgICAgIG9wcy5wdXNoKHtcbiAgICAgICAgb3BlcmF0aW9uOiAncmVtb3ZlJyxcbiAgICAgICAgcHJvcGVydHk6ICdwYXJ0aWNpcGFudHMnLFxuICAgICAgICBpZDogcGFydGljaXBhbnQuaWQsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNoYW5nZS5hZGQuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiB7XG4gICAgICBvcHMucHVzaCh7XG4gICAgICAgIG9wZXJhdGlvbjogJ2FkZCcsXG4gICAgICAgIHByb3BlcnR5OiAncGFydGljaXBhbnRzJyxcbiAgICAgICAgaWQ6IHBhcnRpY2lwYW50LmlkLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnJyxcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KG9wcyksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmxheWVyLXBhdGNoK2pzb24nLFxuICAgICAgfSxcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcykgdGhpcy5fbG9hZCgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsbHkgd2UgdXNlIGB7YWRkOiBbXSwgcmVtb3ZlOiBbXX1gIGluc3RlYWQgb2YgTGF5ZXJPcGVyYXRpb25zLlxuICAgKlxuICAgKiBTbyBjb250cm9sIGlzIGhhbmRlZCBvZmYgdG8gdGhpcyBtZXRob2QgdG8gYWN0dWFsbHkgYXBwbHkgdGhlIGNoYW5nZXNcbiAgICogdG8gdGhlIHBhcnRpY2lwYW50cyBhcnJheS5cbiAgICpcbiAgICogQG1ldGhvZCBfYXBwbHlQYXJ0aWNpcGFudENoYW5nZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNoYW5nZVxuICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eVtdfSBjaGFuZ2UuYWRkIC0gQXJyYXkgb2YgdXNlcmlkcyB0byBhZGRcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHlbXX0gY2hhbmdlLnJlbW92ZSAtIEFycmF5IG9mIHVzZXJpZHMgdG8gcmVtb3ZlXG4gICAqL1xuICBfYXBwbHlQYXJ0aWNpcGFudENoYW5nZShjaGFuZ2UpIHtcbiAgICBjb25zdCBwYXJ0aWNpcGFudHMgPSBbXS5jb25jYXQodGhpcy5wYXJ0aWNpcGFudHMpO1xuICAgIGNoYW5nZS5hZGQuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiB7XG4gICAgICBpZiAocGFydGljaXBhbnRzLmluZGV4T2YocGFydGljaXBhbnQpID09PSAtMSkgcGFydGljaXBhbnRzLnB1c2gocGFydGljaXBhbnQpO1xuICAgIH0pO1xuICAgIGNoYW5nZS5yZW1vdmUuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHBhcnRpY2lwYW50cy5pbmRleE9mKHBhcnRpY2lwYW50KTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHBhcnRpY2lwYW50cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0pO1xuICAgIHRoaXMucGFydGljaXBhbnRzID0gcGFydGljaXBhbnRzO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciBhbmQgcmVtb3ZlcyB0aGlzIHVzZXIgYXMgYSBwYXJ0aWNpcGFudC5cbiAgICpcbiAgICogQG1ldGhvZCBsZWF2ZVxuICAgKi9cbiAgbGVhdmUoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuICAgIHRoaXMuX2RlbGV0ZShgbW9kZT0ke0NvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVN9JmxlYXZlPXRydWVgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIENvbnZlcnNhdGlvbiBmcm9tIHRoZSBzZXJ2ZXIsIGJ1dCBkZWxldGlvbiBtb2RlIG1heSBjYXVzZSB1c2VyIHRvIHJlbWFpbiBhIHBhcnRpY2lwYW50LlxuICAgKlxuICAgKiBUaGlzIGNhbGwgd2lsbCBzdXBwb3J0IHZhcmlvdXMgZGVsZXRpb24gbW9kZXMuXG4gICAqXG4gICAqIERlbGV0aW9uIE1vZGVzOlxuICAgKlxuICAgKiAqIGxheWVyLkNvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTDogVGhpcyBkZWxldGVzIHRoZSBsb2NhbCBjb3B5IGltbWVkaWF0ZWx5LCBhbmQgYXR0ZW1wdHMgdG8gYWxzb1xuICAgKiAgIGRlbGV0ZSB0aGUgc2VydmVyJ3MgY29weS5cbiAgICogKiBsYXllci5Db25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTOiBEZWxldGVzIHRoZSBsb2NhbCBjb3B5IGltbWVkaWF0ZWx5LCBhbmQgYXR0ZW1wdHMgdG8gZGVsZXRlIGl0IGZyb20gYWxsXG4gICAqICAgb2YgbXkgZGV2aWNlcy4gIE90aGVyIHVzZXJzIHJldGFpbiBhY2Nlc3MuXG4gICAqICogdHJ1ZTogRm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHRoaSBpcyB0aGUgc2FtZSBhcyBBTEwuXG4gICAqXG4gICAqIE1ZX0RFVklDRVMgZG9lcyBub3QgcmVtb3ZlIHRoaXMgdXNlciBhcyBhIHBhcnRpY2lwYW50LiAgVGhhdCBtZWFucyBhIG5ldyBNZXNzYWdlIG9uIHRoaXMgQ29udmVyc2F0aW9uIHdpbGwgcmVjcmVhdGUgdGhlXG4gICAqIENvbnZlcnNhdGlvbiBmb3IgdGhpcyB1c2VyLiAgU2VlIGxheWVyLkNvbnZlcnNhdGlvbi5sZWF2ZSgpIGluc3RlYWQuXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIDEuIFN1Ym1pdHMgYSByZXF1ZXN0IHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlciB0byBkZWxldGUgdGhlIHNlcnZlcidzIG9iamVjdFxuICAgKiAyLiBEZWxldGUncyB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDMuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IHRoZSBDb252ZXJzYXRpb24gd2lsbCBiZSByZWxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIsXG4gICAqICAgIHRyaWdnZXJpbmcgYSBjb252ZXJzYXRpb25zOmFkZCBldmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGRlbGV0aW9uTW9kZVxuICAgKi9cbiAgZGVsZXRlKG1vZGUpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pc0Rlc3Ryb3llZCk7XG5cbiAgICBsZXQgcXVlcnlTdHI7XG4gICAgc3dpdGNoIChtb2RlKSB7XG4gICAgICBjYXNlIENvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTDpcbiAgICAgIGNhc2UgdHJ1ZTpcbiAgICAgICAgcXVlcnlTdHIgPSBgbW9kZT0ke0NvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTH1gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzpcbiAgICAgICAgcXVlcnlTdHIgPSBgbW9kZT0ke0NvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVN9JmxlYXZlPWZhbHNlYDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmRlbGV0aW9uTW9kZVVuc3VwcG9ydGVkKTtcbiAgICB9XG5cbiAgICB0aGlzLl9kZWxldGUocXVlcnlTdHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciAoaW50ZXJuYWwgdmVyc2lvbikuXG4gICAqXG4gICAqIFRoaXMgdmVyc2lvbiBvZiBEZWxldGUgdGFrZXMgYSBRdWVyeSBTdHJpbmcgdGhhdCBpcyBwYWNrYWdlZCB1cCBieVxuICAgKiBsYXllci5Db252ZXJzYXRpb24uZGVsZXRlIGFuZCBsYXllci5Db252ZXJzYXRpb24ubGVhdmUuXG4gICAqXG4gICAqIEBtZXRob2QgX2RlbGV0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gcXVlcnlTdHIgLSBRdWVyeSBzdHJpbmcgZm9yIHRoZSBERUxFVEUgcmVxdWVzdFxuICAgKi9cbiAgX2RlbGV0ZShxdWVyeVN0cikge1xuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuX3hocih7XG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgdXJsOiAnPycgKyBxdWVyeVN0cixcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAoIXJlc3VsdC5kYXRhIHx8IHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJykpIENvbnZlcnNhdGlvbi5sb2FkKGlkLCBjbGllbnQpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fZGVsZXRlZCgpO1xuICAgIHRoaXMuZGVzdHJveSgpO1xuICB9XG5cbiAgX2hhbmRsZVdlYnNvY2tldERlbGV0ZShkYXRhKSB7XG4gICAgaWYgKGRhdGEubW9kZSA9PT0gQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUyAmJiBkYXRhLmZyb21fcG9zaXRpb24pIHtcbiAgICAgIHRoaXMuZ2V0Q2xpZW50KCkuX3B1cmdlTWVzc2FnZXNCeVBvc2l0aW9uKHRoaXMuaWQsIGRhdGEuZnJvbV9wb3NpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1cGVyLl9oYW5kbGVXZWJzb2NrZXREZWxldGUoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGxheWVyLk1lc3NhZ2UgaW5zdGFuY2Ugd2l0aGluIHRoaXMgY29udmVyc2F0aW9uXG4gICAqXG4gICAqICAgICAgdmFyIG1lc3NhZ2UgPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnaGVsbG8nKTtcbiAgICpcbiAgICogICAgICB2YXIgbWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAgICogICAgICAgICAgcGFydHM6IFtuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe1xuICAgKiAgICAgICAgICAgICAgICAgICAgICBib2R5OiAnaGVsbG8nLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gICAqICAgICAgICAgICAgICAgICAgfSldXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIFNlZSBsYXllci5NZXNzYWdlIGZvciBtb3JlIG9wdGlvbnMgZm9yIGNyZWF0aW5nIHRoZSBtZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIGNyZWF0ZU1lc3NhZ2VcbiAgICogQHBhcmFtICB7c3RyaW5nfE9iamVjdH0gb3B0aW9ucyAtIElmIGl0cyBhIHN0cmluZywgYSBNZXNzYWdlUGFydCBpcyBjcmVhdGVkIGFyb3VuZCB0aGF0IHN0cmluZy5cbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlUGFydFtdfSBvcHRpb25zLnBhcnRzIC0gQW4gYXJyYXkgb2YgTWVzc2FnZVBhcnRzLiAgVGhlcmUgaXMgc29tZSB0b2xlcmFuY2UgZm9yXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdCBub3QgYmVpbmcgYW4gYXJyYXksIG9yIGZvciBpdCBiZWluZyBhIHN0cmluZyB0byBiZSB0dXJuZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludG8gYSBNZXNzYWdlUGFydC5cbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX1cbiAgICovXG4gIGNyZWF0ZU1lc3NhZ2Uob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbWVzc2FnZUNvbmZpZyA9ICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpID8ge1xuICAgICAgcGFydHM6IFt7IGJvZHk6IG9wdGlvbnMsIG1pbWVUeXBlOiAndGV4dC9wbGFpbicgfV0sXG4gICAgfSA6IG9wdGlvbnM7XG4gICAgbWVzc2FnZUNvbmZpZy5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgbWVzc2FnZUNvbmZpZy5jb252ZXJzYXRpb25JZCA9IHRoaXMuaWQ7XG5cbiAgICByZXR1cm4gbmV3IE1lc3NhZ2UobWVzc2FnZUNvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICogTGF5ZXJQYXRjaCB3aWxsIGNhbGwgdGhpcyBhZnRlciBjaGFuZ2luZyBhbnkgcHJvcGVydGllcy5cbiAgICpcbiAgICogVHJpZ2dlciBhbnkgY2xlYW51cCBvciBldmVudHMgbmVlZGVkIGFmdGVyIHRoZXNlIGNoYW5nZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVBhdGNoRXZlbnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7TWl4ZWR9IG5ld1ZhbHVlIC0gTmV3IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0gIHtNaXhlZH0gb2xkVmFsdWUgLSBQcmlvciB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICogQHBhcmFtICB7c3RyaW5nW119IHBhdGhzIC0gQXJyYXkgb2YgcGF0aHMgc3BlY2lmaWNhbGx5IG1vZGlmaWVkOiBbJ3BhcnRpY2lwYW50cyddLCBbJ21ldGFkYXRhLmtleUEnLCAnbWV0YWRhdGEua2V5QiddXG4gICAqL1xuICBfaGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSB7XG4gICAgLy8gQ2VydGFpbiB0eXBlcyBvZiBfX3VwZGF0ZSBoYW5kbGVycyBhcmUgZGlzYWJsZWQgd2hpbGUgdmFsdWVzIGFyZSBiZWluZyBzZXQgYnlcbiAgICAvLyBsYXllciBwYXRjaCBwYXJzZXIgYmVjYXVzZSB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHNldHRpbmcgYSB2YWx1ZSAodHJpZ2dlcnMgYW4gZXZlbnQpXG4gICAgLy8gYW5kIGNoYW5nZSBhIHByb3BlcnR5IG9mIGEgdmFsdWUgKHRyaWdnZXJzIG9ubHkgdGhpcyBjYWxsYmFjaykgcmVzdWx0IGluIGluY29uc2lzdGVudFxuICAgIC8vIGJlaGF2aW9ycy4gIEVuYWJsZSB0aGVtIGxvbmcgZW5vdWdoIHRvIGFsbG93IF9fdXBkYXRlIGNhbGxzIHRvIGJlIG1hZGVcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuX2Rpc2FibGVFdmVudHM7XG4gICAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gICAgICBpZiAocGF0aHNbMF0uaW5kZXhPZignbWV0YWRhdGEnKSA9PT0gMCkge1xuICAgICAgICB0aGlzLl9fdXBkYXRlTWV0YWRhdGEobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocyk7XG4gICAgICB9IGVsc2UgaWYgKHBhdGhzWzBdID09PSAncGFydGljaXBhbnRzJykge1xuICAgICAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgICAgICAvLyBvbGRWYWx1ZS9uZXdWYWx1ZSBjb21lIGFzIGEgQmFzaWMgSWRlbnRpdHkgUE9KTzsgbGV0cyBkZWxpdmVyIGV2ZW50cyB3aXRoIGFjdHVhbCBpbnN0YW5jZXNcbiAgICAgICAgb2xkVmFsdWUgPSBvbGRWYWx1ZS5tYXAoaWRlbnRpdHkgPT4gY2xpZW50LmdldElkZW50aXR5KGlkZW50aXR5LmlkKSk7XG4gICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUubWFwKGlkZW50aXR5ID0+IGNsaWVudC5nZXRJZGVudGl0eShpZGVudGl0eS5pZCkpO1xuICAgICAgICB0aGlzLl9fdXBkYXRlUGFydGljaXBhbnRzKG5ld1ZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgICB9XG4gICAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZXZlbnRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gZG8gbm90aGluZ1xuICAgIH1cbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiB0aGUgb2xkVmFsdWUgYW5kIG5ld1ZhbHVlIGZvciBwYXJ0aWNpcGFudHMsXG4gICAqIGdlbmVyYXRlIGEgbGlzdCBvZiB3aG9tIHdhcyBhZGRlZCBhbmQgd2hvbSB3YXMgcmVtb3ZlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0UGFydGljaXBhbnRDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHlbXX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHlbXX0gb2xkVmFsdWVcbiAgICogQHJldHVybiB7T2JqZWN0fSBSZXR1cm5zIGNoYW5nZXMgaW4gdGhlIGZvcm0gb2YgYHthZGQ6IFsuLi5dLCByZW1vdmU6IFsuLi5dfWBcbiAgICovXG4gIF9nZXRQYXJ0aWNpcGFudENoYW5nZShuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBjb25zdCBjaGFuZ2UgPSB7fTtcbiAgICBjaGFuZ2UuYWRkID0gbmV3VmFsdWUuZmlsdGVyKHBhcnRpY2lwYW50ID0+IG9sZFZhbHVlLmluZGV4T2YocGFydGljaXBhbnQpID09PSAtMSk7XG4gICAgY2hhbmdlLnJlbW92ZSA9IG9sZFZhbHVlLmZpbHRlcihwYXJ0aWNpcGFudCA9PiBuZXdWYWx1ZS5pbmRleE9mKHBhcnRpY2lwYW50KSA9PT0gLTEpO1xuICAgIHJldHVybiBjaGFuZ2U7XG4gIH1cblxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgc3BlY2lmaWVkIG1ldGFkYXRhIGtleXMuXG4gICAqXG4gICAqIFVwZGF0ZXMgdGhlIGxvY2FsIG9iamVjdCdzIG1ldGFkYXRhIGFuZCBzeW5jcyB0aGUgY2hhbmdlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLnNldE1ldGFkYXRhUHJvcGVydGllcyh7XG4gICAqICAgICAgICAgICd0aXRsZSc6ICdJIGFtIGEgdGl0bGUnLFxuICAgKiAgICAgICAgICAnY29sb3JzLmJhY2tncm91bmQnOiAncmVkJyxcbiAgICogICAgICAgICAgJ2NvbG9ycy50ZXh0Jzoge1xuICAgKiAgICAgICAgICAgICAgJ2ZpbGwnOiAnYmx1ZScsXG4gICAqICAgICAgICAgICAgICAnc2hhZG93JzogJ2JsYWNrJ1xuICAgKiAgICAgICAgICAgfSxcbiAgICogICAgICAgICAgICdjb2xvcnMudGl0bGUuZmlsbCc6ICdyZWQnXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIFVzZSBzZXRNZXRhZGF0YVByb3BlcnRpZXMgdG8gc3BlY2lmeSB0aGUgcGF0aCB0byBhIHByb3BlcnR5LCBhbmQgYSBuZXcgdmFsdWUgZm9yIHRoYXQgcHJvcGVydHkuXG4gICAqIE11bHRpcGxlIHByb3BlcnRpZXMgY2FuIGJlIGNoYW5nZWQgdGhpcyB3YXkuICBXaGF0ZXZlciB2YWx1ZSB3YXMgdGhlcmUgYmVmb3JlIGlzXG4gICAqIHJlcGxhY2VkIHdpdGggdGhlIG5ldyB2YWx1ZTsgc28gaW4gdGhlIGFib3ZlIGV4YW1wbGUsIHdoYXRldmVyIG90aGVyIGtleXMgbWF5IGhhdmVcbiAgICogZXhpc3RlZCB1bmRlciBgY29sb3JzLnRleHRgIGhhdmUgYmVlbiByZXBsYWNlZCBieSB0aGUgbmV3IG9iamVjdCBge2ZpbGw6ICdibHVlJywgc2hhZG93OiAnYmxhY2snfWAuXG4gICAqXG4gICAqIE5vdGUgYWxzbyB0aGF0IG9ubHkgc3RyaW5nIGFuZCBzdWJvYmplY3RzIGFyZSBhY2NlcHRlZCBhcyB2YWx1ZXMuXG4gICAqXG4gICAqIEtleXMgd2l0aCAnLicgd2lsbCB1cGRhdGUgYSBmaWVsZCBvZiBhbiBvYmplY3QgKGFuZCBjcmVhdGUgYW4gb2JqZWN0IGlmIGl0IHdhc24ndCB0aGVyZSk6XG4gICAqXG4gICAqIEluaXRpYWwgbWV0YWRhdGE6IHt9XG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLnNldE1ldGFkYXRhUHJvcGVydGllcyh7XG4gICAqICAgICAgICAgICdjb2xvcnMuYmFja2dyb3VuZCc6ICdyZWQnLFxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBNZXRhZGF0YSBpcyBub3c6IGB7Y29sb3JzOiB7YmFja2dyb3VuZDogJ3JlZCd9fWBcbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24uc2V0TWV0YWRhdGFQcm9wZXJ0aWVzKHtcbiAgICogICAgICAgICAgJ2NvbG9ycy5mb3JlZ3JvdW5kJzogJ2JsYWNrJyxcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTWV0YWRhdGEgaXMgbm93OiBge2NvbG9yczoge2JhY2tncm91bmQ6ICdyZWQnLCBmb3JlZ3JvdW5kOiAnYmxhY2snfX1gXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIDEuIFVwZGF0ZXMgdGhlIG1ldGFkYXRhIHByb3BlcnR5IG9mIHRoZSBsb2NhbCBvYmplY3RcbiAgICogMi4gVHJpZ2dlcnMgYSBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudFxuICAgKiAzLiBTdWJtaXRzIGEgcmVxdWVzdCB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIgdG8gdXBkYXRlIHRoZSBzZXJ2ZXIncyBvYmplY3RcbiAgICogNC4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIG5vIGVycm9ycyBhcmUgZmlyZWQgZXhjZXB0IGJ5IGxheWVyLlN5bmNNYW5hZ2VyLCBidXQgYW5vdGhlclxuICAgKiAgICBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudCBpcyBmaXJlZCBhcyB0aGUgY2hhbmdlIGlzIHJvbGxlZCBiYWNrLlxuICAgKlxuICAgKiBAbWV0aG9kIHNldE1ldGFkYXRhUHJvcGVydGllc1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IHByb3BlcnRpZXNcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqXG4gICAqL1xuICBzZXRNZXRhZGF0YVByb3BlcnRpZXMocHJvcHMpIHtcbiAgICBjb25zdCBsYXllclBhdGNoT3BlcmF0aW9ucyA9IFtdO1xuICAgIE9iamVjdC5rZXlzKHByb3BzKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgbGV0IGZ1bGxOYW1lID0gbmFtZTtcbiAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lICE9PSAnbWV0YWRhdGEnICYmIG5hbWUuaW5kZXhPZignbWV0YWRhdGEuJykgIT09IDApIHtcbiAgICAgICAgICBmdWxsTmFtZSA9ICdtZXRhZGF0YS4nICsgbmFtZTtcbiAgICAgICAgfVxuICAgICAgICBsYXllclBhdGNoT3BlcmF0aW9ucy5wdXNoKHtcbiAgICAgICAgICBvcGVyYXRpb246ICdzZXQnLFxuICAgICAgICAgIHByb3BlcnR5OiBmdWxsTmFtZSxcbiAgICAgICAgICB2YWx1ZTogcHJvcHNbbmFtZV0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IHRydWU7XG5cbiAgICAvLyBEbyB0aGlzIGJlZm9yZSBzZXRTeW5jaW5nIGFzIGlmIHRoZXJlIGFyZSBhbnkgZXJyb3JzLCB3ZSBzaG91bGQgbmV2ZXIgZXZlblxuICAgIC8vIHN0YXJ0IHNldHRpbmcgdXAgYSByZXF1ZXN0LlxuICAgIFV0aWwubGF5ZXJQYXJzZSh7XG4gICAgICBvYmplY3Q6IHRoaXMsXG4gICAgICB0eXBlOiAnQ29udmVyc2F0aW9uJyxcbiAgICAgIG9wZXJhdGlvbnM6IGxheWVyUGF0Y2hPcGVyYXRpb25zLFxuICAgICAgY2xpZW50OiB0aGlzLmdldENsaWVudCgpLFxuICAgIH0pO1xuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSBmYWxzZTtcblxuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICcnLFxuICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkobGF5ZXJQYXRjaE9wZXJhdGlvbnMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5sYXllci1wYXRjaCtqc29uJyxcbiAgICAgIH0sXG4gICAgfSwgcmVzdWx0ID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgIXRoaXMuaXNEZXN0cm95ZWQpIHRoaXMuX2xvYWQoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICAvKipcbiAgICogRGVsZXRlcyBzcGVjaWZpZWQgbWV0YWRhdGEga2V5cy5cbiAgICpcbiAgICogVXBkYXRlcyB0aGUgbG9jYWwgb2JqZWN0J3MgbWV0YWRhdGEgYW5kIHN5bmNzIHRoZSBjaGFuZ2UgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24uZGVsZXRlTWV0YWRhdGFQcm9wZXJ0aWVzKFxuICAgKiAgICAgICAgICBbJ3RpdGxlJywgJ2NvbG9ycy5iYWNrZ3JvdW5kJywgJ2NvbG9ycy50aXRsZS5maWxsJ11cbiAgICogICAgICApO1xuICAgKlxuICAgKiBVc2UgZGVsZXRlTWV0YWRhdGFQcm9wZXJ0aWVzIHRvIHNwZWNpZnkgcGF0aHMgdG8gcHJvcGVydGllcyB0byBiZSBkZWxldGVkLlxuICAgKiBNdWx0aXBsZSBwcm9wZXJ0aWVzIGNhbiBiZSBkZWxldGVkLlxuICAgKlxuICAgKiBFeGVjdXRlcyBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiAxLiBVcGRhdGVzIHRoZSBtZXRhZGF0YSBwcm9wZXJ0eSBvZiB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDIuIFRyaWdnZXJzIGEgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnRcbiAgICogMy4gU3VibWl0cyBhIHJlcXVlc3QgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyIHRvIHVwZGF0ZSB0aGUgc2VydmVyJ3Mgb2JqZWN0XG4gICAqIDQuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IGFub3RoZXJcbiAgICogICAgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnQgaXMgZmlyZWQgYXMgdGhlIGNoYW5nZSBpcyByb2xsZWQgYmFjay5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVNZXRhZGF0YVByb3BlcnRpZXNcbiAgICogQHBhcmFtICB7c3RyaW5nW119IHByb3BlcnRpZXNcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICBkZWxldGVNZXRhZGF0YVByb3BlcnRpZXMocHJvcHMpIHtcbiAgICBjb25zdCBsYXllclBhdGNoT3BlcmF0aW9ucyA9IFtdO1xuICAgIHByb3BzLmZvckVhY2gocHJvcGVydHkgPT4ge1xuICAgICAgaWYgKHByb3BlcnR5ICE9PSAnbWV0YWRhdGEnICYmIHByb3BlcnR5LmluZGV4T2YoJ21ldGFkYXRhLicpICE9PSAwKSB7XG4gICAgICAgIHByb3BlcnR5ID0gJ21ldGFkYXRhLicgKyBwcm9wZXJ0eTtcbiAgICAgIH1cbiAgICAgIGxheWVyUGF0Y2hPcGVyYXRpb25zLnB1c2goe1xuICAgICAgICBvcGVyYXRpb246ICdkZWxldGUnLFxuICAgICAgICBwcm9wZXJ0eSxcbiAgICAgIH0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IHRydWU7XG5cbiAgICAvLyBEbyB0aGlzIGJlZm9yZSBzZXRTeW5jaW5nIGFzIGlmIHRoZXJlIGFyZSBhbnkgZXJyb3JzLCB3ZSBzaG91bGQgbmV2ZXIgZXZlblxuICAgIC8vIHN0YXJ0IHNldHRpbmcgdXAgYSByZXF1ZXN0LlxuICAgIFV0aWwubGF5ZXJQYXJzZSh7XG4gICAgICBvYmplY3Q6IHRoaXMsXG4gICAgICB0eXBlOiAnQ29udmVyc2F0aW9uJyxcbiAgICAgIG9wZXJhdGlvbnM6IGxheWVyUGF0Y2hPcGVyYXRpb25zLFxuICAgICAgY2xpZW50OiB0aGlzLmdldENsaWVudCgpLFxuICAgIH0pO1xuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSBmYWxzZTtcblxuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICcnLFxuICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkobGF5ZXJQYXRjaE9wZXJhdGlvbnMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5sYXllci1wYXRjaCtqc29uJyxcbiAgICAgIH0sXG4gICAgfSwgcmVzdWx0ID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRoaXMuX2xvYWQoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgX2dldFVybCh1cmwpIHtcbiAgICByZXR1cm4gdGhpcy51cmwgKyAodXJsIHx8ICcnKTtcbiAgfVxuXG4gIF9sb2FkZWQoZGF0YSkge1xuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX2FkZENvbnZlcnNhdGlvbih0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFuZGFyZCBgb24oKWAgcHJvdmlkZWQgYnkgbGF5ZXIuUm9vdC5cbiAgICpcbiAgICogQWRkcyBzb21lIHNwZWNpYWwgaGFuZGxpbmcgb2YgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyBzbyB0aGF0IGNhbGxzIHN1Y2ggYXNcbiAgICpcbiAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvMTIzJywgdHJ1ZSlcbiAgICogICAgICAub24oJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIG15cmVyZW5kZXIoYyk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgbXlyZW5kZXIoYyk7IC8vIHJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBjIHVudGlsIHRoZSBkZXRhaWxzIG9mIGMgaGF2ZSBsb2FkZWRcbiAgICpcbiAgICogY2FuIGZpcmUgdGhlaXIgY2FsbGJhY2sgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBjbGllbnQgbG9hZHMgb3IgaGFzXG4gICAqIGFscmVhZHkgbG9hZGVkIHRoZSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEBtZXRob2Qgb25cbiAgICogQHBhcmFtICB7c3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgY29uc3QgaGFzTG9hZGVkRXZ0ID0gbmFtZSA9PT0gJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyB8fFxuICAgICAgbmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgJiYgbmFtZVsnY29udmVyc2F0aW9uczpsb2FkZWQnXTtcblxuICAgIGlmIChoYXNMb2FkZWRFdnQgJiYgIXRoaXMuaXNMb2FkaW5nKSB7XG4gICAgICBjb25zdCBjYWxsTm93ID0gbmFtZSA9PT0gJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyA/IGNhbGxiYWNrIDogbmFtZVsnY29udmVyc2F0aW9uczpsb2FkZWQnXTtcbiAgICAgIFV0aWwuZGVmZXIoKCkgPT4gY2FsbE5vdy5hcHBseShjb250ZXh0KSk7XG4gICAgfVxuICAgIHN1cGVyLm9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogSW5zdXJlIHRoYXQgY29udmVyc2F0aW9uLnVucmVhZENvdW50LS0gY2FuIG5ldmVyIHJlZHVjZSB0aGUgdmFsdWUgdG8gbmVnYXRpdmUgdmFsdWVzLlxuICAgKi9cbiAgX19hZGp1c3RVbnJlYWRDb3VudChuZXdWYWx1ZSkge1xuICAgIGlmIChuZXdWYWx1ZSA8IDApIHJldHVybiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBjaGFuZ2UgaW4gdGhlIHVucmVhZENvdW50IHByb3BlcnR5IHdpbGwgY2FsbCB0aGlzIG1ldGhvZCBhbmQgZmlyZSBhXG4gICAqIGNoYW5nZSBldmVudC5cbiAgICpcbiAgICogQW55IHRyaWdnZXJpbmcgb2YgdGhpcyBmcm9tIGEgd2Vic29ja2V0IHBhdGNoIHVucmVhZF9tZXNzYWdlX2NvdW50IHNob3VsZCB3YWl0IGEgc2Vjb25kIGJlZm9yZSBmaXJpbmcgYW55IGV2ZW50c1xuICAgKiBzbyB0aGF0IGlmIHRoZXJlIGFyZSBhIHNlcmllcyBvZiB0aGVzZSB1cGRhdGVzLCB3ZSBkb24ndCBzZWUgYSBsb3Qgb2Ygaml0dGVyLlxuICAgKlxuICAgKiBOT1RFOiBfb2xkVW5yZWFkQ291bnQgaXMgdXNlZCB0byBwYXNzIGRhdGEgdG8gX3VwZGF0ZVVucmVhZENvdW50RXZlbnQgYmVjYXVzZSB0aGlzIG1ldGhvZCBjYW4gYmUgY2FsbGVkIG1hbnkgdGltZXNcbiAgICogYSBzZWNvbmQsIGFuZCB3ZSBvbmx5IHdhbnQgdG8gdHJpZ2dlciB0aGlzIHdpdGggYSBzdW1tYXJ5IG9mIGNoYW5nZXMgcmF0aGVyIHRoYW4gZWFjaCBpbmRpdmlkdWFsIGNoYW5nZS5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZVVucmVhZENvdW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge251bWJlcn0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7bnVtYmVyfSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVVbnJlYWRDb3VudChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAodGhpcy5faW5MYXllclBhcnNlcikge1xuICAgICAgaWYgKHRoaXMuX29sZFVucmVhZENvdW50ID09PSB1bmRlZmluZWQpIHRoaXMuX29sZFVucmVhZENvdW50ID0gb2xkVmFsdWU7XG4gICAgICBpZiAodGhpcy5fdXBkYXRlVW5yZWFkQ291bnRUaW1lb3V0KSBjbGVhclRpbWVvdXQodGhpcy5fdXBkYXRlVW5yZWFkQ291bnRUaW1lb3V0KTtcbiAgICAgIHRoaXMuX3VwZGF0ZVVucmVhZENvdW50VGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fdXBkYXRlVW5yZWFkQ291bnRFdmVudCgpLCAxMDAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdXBkYXRlVW5yZWFkQ291bnRFdmVudCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaXJlIGV2ZW50cyByZWxhdGVkIHRvIGNoYW5nZXMgdG8gdW5yZWFkQ291bnRcbiAgICpcbiAgICogQG1ldGhvZCBfdXBkYXRlVW5yZWFkQ291bnRFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3VwZGF0ZVVucmVhZENvdW50RXZlbnQoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX29sZFVucmVhZENvdW50O1xuICAgIGNvbnN0IG5ld1ZhbHVlID0gdGhpcy5fX3VucmVhZENvdW50O1xuICAgIHRoaXMuX29sZFVucmVhZENvdW50ID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKG5ld1ZhbHVlID09PSBvbGRWYWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpjaGFuZ2UnLCB7XG4gICAgICBuZXdWYWx1ZSxcbiAgICAgIG9sZFZhbHVlLFxuICAgICAgcHJvcGVydHk6ICd1bnJlYWRDb3VudCcsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGNoYW5nZSBpbiB0aGUgbGFzdE1lc3NhZ2UgcG9pbnRlciB3aWxsIGNhbGwgdGhpcyBtZXRob2QgYW5kIGZpcmUgYVxuICAgKiBjaGFuZ2UgZXZlbnQuICBDaGFuZ2VzIHRvIHByb3BlcnRpZXMgd2l0aGluIHRoZSBsYXN0TWVzc2FnZSBvYmplY3Qgd2lsbFxuICAgKiBub3QgdHJpZ2dlciB0aGlzIGNhbGwuXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVMYXN0TWVzc2FnZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5NZXNzYWdlfSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtsYXllci5NZXNzYWdlfSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVMYXN0TWVzc2FnZShuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAobmV3VmFsdWUgJiYgb2xkVmFsdWUgJiYgbmV3VmFsdWUuaWQgPT09IG9sZFZhbHVlLmlkKSByZXR1cm47XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnbGFzdE1lc3NhZ2UnLFxuICAgICAgbmV3VmFsdWUsXG4gICAgICBvbGRWYWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBwYXJ0aWNpcGFudHMgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LiAgQ2hhbmdlcyB0byB0aGUgcGFydGljaXBhbnRzIGFycmF5IHRoYXQgZG9uJ3QgcmVwbGFjZSB0aGUgYXJyYXlcbiAgICogd2l0aCBhIG5ldyBhcnJheSB3aWxsIHJlcXVpcmUgZGlyZWN0bHkgY2FsbGluZyB0aGlzIG1ldGhvZC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZVBhcnRpY2lwYW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmdbXX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7c3RyaW5nW119IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZVBhcnRpY2lwYW50cyhuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAodGhpcy5faW5MYXllclBhcnNlcikgcmV0dXJuO1xuICAgIGNvbnN0IGNoYW5nZSA9IHRoaXMuX2dldFBhcnRpY2lwYW50Q2hhbmdlKG5ld1ZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgaWYgKGNoYW5nZS5hZGQubGVuZ3RoIHx8IGNoYW5nZS5yZW1vdmUubGVuZ3RoKSB7XG4gICAgICBjaGFuZ2UucHJvcGVydHkgPSAncGFydGljaXBhbnRzJztcbiAgICAgIGNoYW5nZS5vbGRWYWx1ZSA9IG9sZFZhbHVlO1xuICAgICAgY2hhbmdlLm5ld1ZhbHVlID0gbmV3VmFsdWU7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJywgY2hhbmdlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGNoYW5nZSBpbiB0aGUgbWV0YWRhdGEgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LiAgQ2hhbmdlcyB0byB0aGUgbWV0YWRhdGEgb2JqZWN0IHRoYXQgZG9uJ3QgcmVwbGFjZSB0aGUgb2JqZWN0XG4gICAqIHdpdGggYSBuZXcgb2JqZWN0IHdpbGwgcmVxdWlyZSBkaXJlY3RseSBjYWxsaW5nIHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlTWV0YWRhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZU1ldGFkYXRhKG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpIHtcbiAgICBpZiAodGhpcy5faW5MYXllclBhcnNlcikgcmV0dXJuO1xuICAgIGlmIChKU09OLnN0cmluZ2lmeShuZXdWYWx1ZSkgIT09IEpTT04uc3RyaW5naWZ5KG9sZFZhbHVlKSkge1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgICAgcHJvcGVydHk6ICdtZXRhZGF0YScsXG4gICAgICAgIG5ld1ZhbHVlLFxuICAgICAgICBvbGRWYWx1ZSxcbiAgICAgICAgcGF0aHMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIHBsYWluIG9iamVjdC5cbiAgICpcbiAgICogT2JqZWN0IHdpbGwgaGF2ZSBhbGwgdGhlIHNhbWUgcHVibGljIHByb3BlcnRpZXMgYXMgdGhpc1xuICAgKiBDb252ZXJzYXRpb24gaW5zdGFuY2UuICBOZXcgb2JqZWN0IGlzIHJldHVybmVkIGFueSB0aW1lXG4gICAqIGFueSBvZiB0aGlzIG9iamVjdCdzIHByb3BlcnRpZXMgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gUE9KTyB2ZXJzaW9uIG9mIHRoaXMuXG4gICAqL1xuICB0b09iamVjdCgpIHtcbiAgICBpZiAoIXRoaXMuX3RvT2JqZWN0KSB7XG4gICAgICB0aGlzLl90b09iamVjdCA9IHN1cGVyLnRvT2JqZWN0KCk7XG4gICAgICB0aGlzLl90b09iamVjdC5tZXRhZGF0YSA9IFV0aWwuY2xvbmUodGhpcy5tZXRhZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjb252ZXJzYXRpb24gaW5zdGFuY2UgZnJvbSBhIHNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBJZiB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzLCB3aWxsIHVwZGF0ZSB0aGUgZXhpc3RpbmcgY29weSB3aXRoXG4gICAqIHByZXN1bWFibHkgbmV3ZXIgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnZlcnNhdGlvbiAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiBhIENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIoY29udmVyc2F0aW9uLCBjbGllbnQpIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbih7XG4gICAgICBjbGllbnQsXG4gICAgICBmcm9tU2VydmVyOiBjb252ZXJzYXRpb24sXG4gICAgICBfZnJvbURCOiBjb252ZXJzYXRpb24uX2Zyb21EQixcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIG9yIGNyZWF0ZSBhIG5ldyBjb252ZXJhdGlvbi5cbiAgICpcbiAgICogICAgICB2YXIgY29udmVyc2F0aW9uID0gbGF5ZXIuQ29udmVyc2F0aW9uLmNyZWF0ZSh7XG4gICAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgZGlzdGluY3Q6IHRydWUsXG4gICAqICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAqICAgICAgICAgICAgICB0aXRsZTogJ0kgYW0gbm90IGEgdGl0bGUhJ1xuICAgKiAgICAgICAgICB9LFxuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICAgICAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJzogZnVuY3Rpb24oZXZ0KSB7XG4gICAqXG4gICAqICAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogT25seSB0cmllcyB0byBmaW5kIGEgQ29udmVyc2F0aW9uIGlmIGl0cyBhIERpc3RpbmN0IENvbnZlcnNhdGlvbi5cbiAgICogRGlzdGluY3QgZGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICpcbiAgICogUmVjb21tZW5kIHVzaW5nIGBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHsuLi59KWBcbiAgICogaW5zdGVhZCBvZiBgQ29udmVyc2F0aW9uLmNyZWF0ZSh7Li4ufSlgLlxuICAgKlxuICAgKiBAbWV0aG9kIGNyZWF0ZVxuICAgKiBAc3RhdGljXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gb3B0aW9ucy5jbGllbnRcbiAgICogQHBhcmFtICB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gb3B0aW9ucy5wYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgbGF5ZXIuSWRlbnRpdHkgb2JqZWN0cyB0byBjcmVhdGUgYSBjb252ZXJzYXRpb24gd2l0aC5cbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kaXN0aW5jdD10cnVlXSAtIENyZWF0ZSBhIGRpc3RpbmN0IGNvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubWV0YWRhdGE9e31dIC0gSW5pdGlhbCBtZXRhZGF0YSBmb3IgQ29udmVyc2F0aW9uXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICovXG4gIHN0YXRpYyBjcmVhdGUob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5jbGllbnQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG4gICAgY29uc3QgbmV3T3B0aW9ucyA9IHtcbiAgICAgIGRpc3RpbmN0OiBvcHRpb25zLmRpc3RpbmN0LFxuICAgICAgcGFydGljaXBhbnRzOiBvcHRpb25zLmNsaWVudC5fZml4SWRlbnRpdGllcyhvcHRpb25zLnBhcnRpY2lwYW50cyksXG4gICAgICBtZXRhZGF0YTogb3B0aW9ucy5tZXRhZGF0YSxcbiAgICAgIGNsaWVudDogb3B0aW9ucy5jbGllbnQsXG4gICAgfTtcbiAgICBpZiAobmV3T3B0aW9ucy5kaXN0aW5jdCkge1xuICAgICAgY29uc3QgY29udiA9IHRoaXMuX2NyZWF0ZURpc3RpbmN0KG5ld09wdGlvbnMpO1xuICAgICAgaWYgKGNvbnYpIHJldHVybiBjb252O1xuICAgIH1cbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbihuZXdPcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgb3IgRmluZCBhIERpc3RpbmN0IENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogSWYgdGhlIHN0YXRpYyBDb252ZXJzYXRpb24uY3JlYXRlIG1ldGhvZCBnZXRzIGEgcmVxdWVzdCBmb3IgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24sXG4gICAqIHNlZSBpZiB3ZSBoYXZlIG9uZSBjYWNoZWQuXG4gICAqXG4gICAqIFdpbGwgZmlyZSB0aGUgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyBldmVudCBpZiBvbmUgaXMgcHJvdmlkZWQgaW4gdGhpcyBjYWxsLFxuICAgKiBhbmQgYSBDb252ZXJzYXRpb24gaXMgZm91bmQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZURpc3RpbmN0XG4gICAqIEBzdGF0aWNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zIC0gU2VlIGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUgb3B0aW9uczsgcGFydGljaXBhbnRzIG11c3QgYmUgbGF5ZXIuSWRlbnRpdHlbXVxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZURpc3RpbmN0KG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5wYXJ0aWNpcGFudHMuaW5kZXhPZihvcHRpb25zLmNsaWVudC51c2VyKSA9PT0gLTEpIHtcbiAgICAgIG9wdGlvbnMucGFydGljaXBhbnRzLnB1c2gob3B0aW9ucy5jbGllbnQudXNlcik7XG4gICAgfVxuXG4gICAgY29uc3QgcGFydGljaXBhbnRzSGFzaCA9IHt9O1xuICAgIG9wdGlvbnMucGFydGljaXBhbnRzLmZvckVhY2goKHBhcnRpY2lwYW50KSA9PiB7XG4gICAgICBwYXJ0aWNpcGFudHNIYXNoW3BhcnRpY2lwYW50LmlkXSA9IHBhcnRpY2lwYW50O1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29udiA9IG9wdGlvbnMuY2xpZW50LmZpbmRDYWNoZWRDb252ZXJzYXRpb24oYUNvbnYgPT4ge1xuICAgICAgaWYgKGFDb252LmRpc3RpbmN0ICYmIGFDb252LnBhcnRpY2lwYW50cy5sZW5ndGggPT09IG9wdGlvbnMucGFydGljaXBhbnRzLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgYUNvbnYucGFydGljaXBhbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgIGlmICghcGFydGljaXBhbnRzSGFzaFthQ29udi5wYXJ0aWNpcGFudHNbaW5kZXhdLmlkXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGNvbnYpIHtcbiAgICAgIGNvbnYuX3NlbmREaXN0aW5jdEV2ZW50ID0gbmV3IExheWVyRXZlbnQoe1xuICAgICAgICB0YXJnZXQ6IGNvbnYsXG4gICAgICAgIHJlc3VsdDogIW9wdGlvbnMubWV0YWRhdGEgfHwgVXRpbC5kb2VzT2JqZWN0TWF0Y2gob3B0aW9ucy5tZXRhZGF0YSwgY29udi5tZXRhZGF0YSkgP1xuICAgICAgICAgIENvbnZlcnNhdGlvbi5GT1VORCA6IENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSxcbiAgICAgIH0sICdjb252ZXJzYXRpb25zOnNlbnQnKTtcbiAgICAgIHJldHVybiBjb252O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHdoZXRoZXIgYSBDb252ZXJzYXRpb24gcmVjZWl2aW5nIHRoZSBzcGVjaWZpZWQgcGF0Y2ggZGF0YSBzaG91bGQgYmUgbG9hZGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQW55IGNoYW5nZSB0byBhIENvbnZlcnNhdGlvbiBpbmRpY2F0ZXMgdGhhdCB0aGUgQ29udmVyc2F0aW9uIGlzIGFjdGl2ZSBhbmQgb2YgcG90ZW50aWFsIGludGVyZXN0OyBnbyBhaGVhZCBhbmQgbG9hZCB0aGF0XG4gICAqIENvbnZlcnNhdGlvbiBpbiBjYXNlIHRoZSBhcHAgaGFzIG5lZWQgb2YgaXQuICBJbiB0aGUgZnV0dXJlIHdlIG1heSBpZ25vcmUgY2hhbmdlcyB0byB1bnJlYWQgY291bnQuICBPbmx5IHJlbGV2YW50XG4gICAqIHdoZW4gd2UgZ2V0IFdlYnNvY2tldCBldmVudHMgZm9yIGEgQ29udmVyc2F0aW9uIHRoYXQgaGFzIG5vdCBiZWVuIGxvYWRlZC9jYWNoZWQgb24gQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkUmVzb3VyY2VGb3JQYXRjaFxuICAgKiBAc3RhdGljXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgX2xvYWRSZXNvdXJjZUZvclBhdGNoKHBhdGNoRGF0YSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQXJyYXkgb2YgcGFydGljaXBhbnQgaWRzLlxuICpcbiAqIERvIG5vdCBkaXJlY3RseSBtYW5pcHVsYXRlO1xuICogdXNlIGFkZFBhcnRpY2lwYW50cywgcmVtb3ZlUGFydGljaXBhbnRzIGFuZCByZXBsYWNlUGFydGljaXBhbnRzXG4gKiB0byBtYW5pcHVsYXRlIHRoZSBhcnJheS5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuSWRlbnRpdHlbXX1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5wYXJ0aWNpcGFudHMgPSBudWxsO1xuXG4vKipcbiAqIFRpbWUgdGhhdCB0aGUgY29udmVyc2F0aW9uIHdhcyBjcmVhdGVkIG9uIHRoZSBzZXJ2ZXIuXG4gKlxuICogQHR5cGUge0RhdGV9XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUuY3JlYXRlZEF0ID0gbnVsbDtcblxuLyoqXG4gKiBOdW1iZXIgb2YgdW5yZWFkIG1lc3NhZ2VzIGluIHRoZSBjb252ZXJzYXRpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS51bnJlYWRDb3VudCA9IDA7XG5cbi8qKlxuICogVGhpcyBpcyBhIERpc3RpbmN0IENvbnZlcnNhdGlvbi5cbiAqXG4gKiBZb3UgY2FuIGhhdmUgMSBkaXN0aW5jdCBjb252ZXJzYXRpb24gYW1vbmcgYSBzZXQgb2YgcGFydGljaXBhbnRzLlxuICogVGhlcmUgYXJlIG5vIGxpbWl0cyB0byBob3cgbWFueSBub24tZGlzdGluY3QgQ29udmVyc2F0aW9ucyB5b3UgaGF2ZSBoYXZlXG4gKiBhbW9uZyBhIHNldCBvZiBwYXJ0aWNpcGFudHMuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUuZGlzdGluY3QgPSB0cnVlO1xuXG4vKipcbiAqIE1ldGFkYXRhIGZvciB0aGUgY29udmVyc2F0aW9uLlxuICpcbiAqIE1ldGFkYXRhIHZhbHVlcyBjYW4gYmUgcGxhaW4gb2JqZWN0cyBhbmQgc3RyaW5ncywgYnV0XG4gKiBubyBhcnJheXMsIG51bWJlcnMsIGJvb2xlYW5zIG9yIGRhdGVzLlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5tZXRhZGF0YSA9IG51bGw7XG5cblxuLyoqXG4gKiBUaGUgYXV0aGVudGljYXRlZCB1c2VyIGlzIGEgY3VycmVudCBwYXJ0aWNpcGFudCBpbiB0aGlzIENvbnZlcnNhdGlvbi5cbiAqXG4gKiBTZXQgdG8gZmFsc2UgaWYgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhpcyBjb252ZXJzYXRpb24uXG4gKlxuICogQSByZW1vdmVkIHVzZXIgY2FuIHNlZSBtZXNzYWdlcyB1cCB0byB0aGUgdGltZSB0aGV5IHdlcmUgcmVtb3ZlZCxcbiAqIGJ1dCBjYW4gbm8gbG9uZ2VyIGludGVyYWN0IHdpdGggdGhlIGNvbnZlcnNhdGlvbi5cbiAqXG4gKiBBIHJlbW92ZWQgdXNlciBjYW4gbm8gbG9uZ2VyIHNlZSB0aGUgcGFydGljaXBhbnQgbGlzdC5cbiAqXG4gKiBSZWFkIGFuZCBEZWxpdmVyeSByZWNlaXB0cyB3aWxsIGZhaWwgb24gYW55IE1lc3NhZ2UgaW4gc3VjaCBhIENvbnZlcnNhdGlvbi5cbiAqXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5pc0N1cnJlbnRQYXJ0aWNpcGFudCA9IHRydWU7XG5cbi8qKlxuICogVGhlIGxhc3QgbGF5ZXIuTWVzc2FnZSB0byBiZSBzZW50L3JlY2VpdmVkIGZvciB0aGlzIENvbnZlcnNhdGlvbi5cbiAqXG4gKiBWYWx1ZSBtYXkgYmUgYSBNZXNzYWdlIHRoYXQgaGFzIGJlZW4gbG9jYWxseSBjcmVhdGVkIGJ1dCBub3QgeWV0IHJlY2VpdmVkIGJ5IHNlcnZlci5cbiAqIEB0eXBlIHtsYXllci5NZXNzYWdlfVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLmxhc3RNZXNzYWdlID0gbnVsbDtcblxuLyoqXG4gKiBDYWNoZXMgbGFzdCByZXN1bHQgb2YgdG9PYmplY3QoKVxuICogQHR5cGUge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUuX3RvT2JqZWN0ID0gbnVsbDtcblxuQ29udmVyc2F0aW9uLmV2ZW50UHJlZml4ID0gJ2NvbnZlcnNhdGlvbnMnO1xuXG4vKipcbiAqIENhY2hlJ3MgYSBEaXN0aW5jdCBFdmVudC5cbiAqXG4gKiBPbiBjcmVhdGluZyBhIERpc3RpbmN0IENvbnZlcnNhdGlvbiB0aGF0IGFscmVhZHkgZXhpc3RzLFxuICogd2hlbiB0aGUgc2VuZCgpIG1ldGhvZCBpcyBjYWxsZWQsIHdlIHNob3VsZCB0cmlnZ2VyXG4gKiBzcGVjaWZpYyBldmVudHMgZGV0YWlsaW5nIHRoZSByZXN1bHRzLiAgUmVzdWx0c1xuICogbWF5IGJlIGRldGVybWluZWQgbG9jYWxseSBvciBvbiB0aGUgc2VydmVyLCBidXQgc2FtZSBFdmVudCBtYXkgYmUgbmVlZGVkLlxuICpcbiAqIEB0eXBlIHtsYXllci5MYXllckV2ZW50fVxuICogQHByaXZhdGVcbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5fc2VuZERpc3RpbmN0RXZlbnQgPSBudWxsO1xuXG4vKipcbiAqIFByZWZpeCB0byB1c2Ugd2hlbiBnZW5lcmF0aW5nIGFuIElEIGZvciBpbnN0YW5jZXMgb2YgdGhpcyBjbGFzc1xuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbkNvbnZlcnNhdGlvbi5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvJztcblxuLyoqXG4gKiBQcm9wZXJ0eSB0byBsb29rIGZvciB3aGVuIGJ1YmJsaW5nIHVwIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICovXG5Db252ZXJzYXRpb24uYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuLyoqXG4gKiBUaGUgQ29udmVyc2F0aW9uIHRoYXQgd2FzIHJlcXVlc3RlZCBoYXMgYmVlbiBjcmVhdGVkLlxuICpcbiAqIFVzZWQgaW4gYGNvbnZlcnNhdGlvbnM6c2VudGAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuQ29udmVyc2F0aW9uLkNSRUFURUQgPSAnQ3JlYXRlZCc7XG5cbi8qKlxuICogVGhlIENvbnZlcnNhdGlvbiB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gZm91bmQuXG4gKlxuICogVGhpcyBtZWFucyB0aGF0IGl0IGRpZCBub3QgbmVlZCB0byBiZSBjcmVhdGVkLlxuICpcbiAqIFVzZWQgaW4gYGNvbnZlcnNhdGlvbnM6c2VudGAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuQ29udmVyc2F0aW9uLkZPVU5EID0gJ0ZvdW5kJztcblxuLyoqXG4gKiBUaGUgQ29udmVyc2F0aW9uIHRoYXQgd2FzIHJlcXVlc3RlZCBoYXMgYmVlbiBmb3VuZCwgYnV0IHRoZXJlIHdhcyBhIG1pc21hdGNoIGluIG1ldGFkYXRhLlxuICpcbiAqIElmIHRoZSBjcmVhdGVDb252ZXJzYXRpb24gcmVxdWVzdCBjb250YWluZWQgbWV0YWRhdGEgYW5kIGl0IGRpZCBub3QgbWF0Y2ggdGhlIERpc3RpbmN0IENvbnZlcnNhdGlvblxuICogdGhhdCBtYXRjaGVkIHRoZSByZXF1ZXN0ZWQgcGFydGljaXBhbnRzLCB0aGVuIHRoaXMgdmFsdWUgaXMgcGFzc2VkIHRvIG5vdGlmeSB5b3VyIGFwcCB0aGF0IHRoZSBDb252ZXJzYXRpb25cbiAqIHdhcyByZXR1cm5lZCBidXQgZG9lcyBub3QgZXhhY3RseSBtYXRjaCB5b3VyIHJlcXVlc3QuXG4gKlxuICogVXNlZCBpbiBgY29udmVyc2F0aW9uczpzZW50YCBldmVudHMuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5Db252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEgPSAnRm91bmRNaXNtYXRjaCc7XG5cbkNvbnZlcnNhdGlvbi5fc3VwcG9ydGVkRXZlbnRzID0gW1xuXG5cblxuICAvKipcbiAgICogVGhlIGNvbnZlcnNhdGlvbiBpcyBub3cgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGFmdGVyIHN1Y2Nlc3NmdWxseSBjcmVhdGluZyB0aGUgY29udmVyc2F0aW9uXG4gICAqIG9uIHRoZSBzZXJ2ZXIuICBUaGUgUmVzdWx0IHByb3BlcnR5IGlzIG9uZSBvZjpcbiAgICpcbiAgICogKiBDb252ZXJzYXRpb24uQ1JFQVRFRDogQSBuZXcgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICogKiBDb252ZXJzYXRpb24uRk9VTkQ6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAqICogQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBOiBBIG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvbiBoYXMgYmVlbiBmb3VuZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgYnV0IG5vdGUgdGhhdCB0aGUgbWV0YWRhdGEgaXMgTk9UIHdoYXQgeW91IHJlcXVlc3RlZC5cbiAgICpcbiAgICogQWxsIG9mIHRoZXNlIHJlc3VsdHMgd2lsbCBhbHNvIG1lYW4gdGhhdCB0aGUgdXBkYXRlZCBwcm9wZXJ0eSB2YWx1ZXMgaGF2ZSBiZWVuXG4gICAqIGNvcGllZCBpbnRvIHlvdXIgQ29udmVyc2F0aW9uIG9iamVjdC4gIFRoYXQgbWVhbnMgeW91ciBtZXRhZGF0YSBwcm9wZXJ0eSBtYXkgbm9cbiAgICogbG9uZ2VyIGJlIGl0cyBpbml0aWFsIHZhbHVlOyBpdCBtYXkgYmUgdGhlIHZhbHVlIGZvdW5kIG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5yZXN1bHRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOnNlbnQnLFxuXG4gIC8qKlxuICAgKiBBbiBhdHRlbXB0IHRvIHNlbmQgdGhpcyBjb252ZXJzYXRpb24gdG8gdGhlIHNlcnZlciBoYXMgZmFpbGVkLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2ZW50LmVycm9yXG4gICAqL1xuICAnY29udmVyc2F0aW9uczpzZW50LWVycm9yJyxcblxuICAvKipcbiAgICogVGhlIGNvbnZlcnNhdGlvbiBpcyBub3cgbG9hZGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIHRoZSBsYXllci5Db252ZXJzYXRpb24ubG9hZCgpIG1ldGhvZC5cbiAgICogZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyxcblxuICAvKipcbiAgICogQW4gYXR0ZW1wdCB0byBsb2FkIHRoaXMgY29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciBoYXMgZmFpbGVkLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLkNvbnZlcnNhdGlvbi5sb2FkKCkgbWV0aG9kLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2ZW50LmVycm9yXG4gICAqL1xuICAnY29udmVyc2F0aW9uczpsb2FkZWQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBUaGUgY29udmVyc2F0aW9uIGhhcyBiZWVuIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYXVzZWQgYnkgZWl0aGVyIGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGRlbGV0ZSgpIG9uIHRoaXMgaW5zdGFuY2VcbiAgICogb3IgYnkgYSByZW1vdGUgdXNlci5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmRlbGV0ZScsXG5cbiAgLyoqXG4gICAqIFRoaXMgY29udmVyc2F0aW9uIGhhcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge09iamVjdFtdfSBldmVudC5jaGFuZ2VzIC0gQXJyYXkgb2YgY2hhbmdlcyByZXBvcnRlZCBieSB0aGlzIGV2ZW50XG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2ZW50LmNoYW5nZXMubmV3VmFsdWVcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZlbnQuY2hhbmdlcy5vbGRWYWx1ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQuY2hhbmdlcy5wcm9wZXJ0eSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgY2hhbmdlZFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gZXZlbnQudGFyZ2V0XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpjaGFuZ2UnXS5jb25jYXQoU3luY2FibGUuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KENvbnZlcnNhdGlvbiwgW0NvbnZlcnNhdGlvbiwgJ0NvbnZlcnNhdGlvbiddKTtcblN5bmNhYmxlLnN1YmNsYXNzZXMucHVzaChDb252ZXJzYXRpb24pO1xubW9kdWxlLmV4cG9ydHMgPSBDb252ZXJzYXRpb247XG4iXX0=
