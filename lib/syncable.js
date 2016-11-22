'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Syncable abstract clas represents resources that are syncable with the server.
 * This is currently used for Messages and Conversations.
 * It represents the state of the object's sync, as one of:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @class layer.Syncable
 * @extends layer.Root
 * @abstract
 */

var Root = require('./root');

var _require = require('./const'),
    SYNC_STATE = _require.SYNC_STATE;

var LayerError = require('./layer-error');
var ClientRegistry = require('./client-registry');
var Constants = require('./const');

var Syncable = function (_Root) {
  _inherits(Syncable, _Root);

  function Syncable() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Syncable);

    var _this = _possibleConstructorReturn(this, (Syncable.__proto__ || Object.getPrototypeOf(Syncable)).call(this, options));

    _this.localCreatedAt = new Date();
    return _this;
  }

  /**
   * Get the client associated with this Object.
   *
   * @method getClient
   * @return {layer.Client}
   */


  _createClass(Syncable, [{
    key: 'getClient',
    value: function getClient() {
      return ClientRegistry.get(this.clientId);
    }

    /**
     * Fire an XHR request using the URL for this resource.
     *
     * For more info on xhr method parameters see {@link layer.ClientAuthenticator#xhr}
     *
     * @method _xhr
     * @protected
     * @return {layer.Syncable} this
     */

  }, {
    key: '_xhr',
    value: function _xhr(options, callback) {
      var _this2 = this;

      // initialize
      if (!options.url) options.url = '';
      if (!options.method) options.method = 'GET';
      var client = this.getClient();

      // Validatation
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      if (!client) throw new Error(LayerError.dictionary.clientMissing);
      if (!this.constructor.enableOpsIfNew && options.method !== 'POST' && options.method !== 'GET' && this.syncState === Constants.SYNC_STATE.NEW) return this;

      if (!options.url.match(/^http(s):\/\//)) {
        if (options.url && !options.url.match(/^(\/|\?)/)) options.url = '/' + options.url;
        if (!options.sync) options.url = this.url + options.url;
      }

      // Setup sync structure
      options.sync = this._setupSyncObject(options.sync);

      if (options.method !== 'GET') {
        this._setSyncing();
      }

      client.xhr(options, function (result) {
        if (result.success && options.method !== 'GET' && !_this2.isDestroyed) {
          _this2._setSynced();
        }
        if (callback) callback(result);
      });
      return this;
    }

    /**
     * Setup an object to pass in the `sync` parameter for any sync requests.
     *
     * @method _setupSyncObject
     * @private
     * @param {Object} sync - Known parameters of the sync object to be returned; or null.
     * @return {Object} fleshed out sync object
     */

  }, {
    key: '_setupSyncObject',
    value: function _setupSyncObject(sync) {
      if (sync !== false) {
        if (!sync) sync = {};
        if (!sync.target) sync.target = this.id;
      }
      return sync;
    }

    /**
     * A websocket event has been received specifying that this resource
     * has been deleted.
     *
     * @method handleWebsocketDelete
     * @protected
     * @param {Object} data
     */

  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      this._deleted();
      this.destroy();
    }

    /**
     * The Object has been deleted.
     *
     * Destroy must be called separately, and handles most cleanup.
     *
     * @method _deleted
     * @protected
     */

  }, {
    key: '_deleted',
    value: function _deleted() {
      this.trigger(this.constructor.eventPrefix + ':delete');
    }

    /**
     * Load the resource identified via a Layer ID.
     *
     * Will load the requested resource from persistence or server as needed,
     * and trigger `type-name:loaded` when its loaded.  Instance returned by this
     * method will have only ID and URL properties, all others are unset until
     * the `conversations:loaded`, `messages:loaded`, etc... event has fired.
     *
     * ```
     * var message = layer.Message.load(messageId, client);
     * message.once('messages:loaded', function(evt) {
     *    alert("Message loaded");
     * });
     * ```
     *
     * @method load
     * @static
     * @param {string} id - `layer:///messages/UUID`
     * @param {layer.Client} client
     * @return {layer.Syncable} - Returns an empty object that will be populated once data is loaded.
     */

  }, {
    key: '_load',


    /**
     * Load this resource from the server.
     *
     * Called from the static layer.Syncable.load() method
     *
     * @method _load
     * @private
     */
    value: function _load() {
      var _this3 = this;

      this.syncState = SYNC_STATE.LOADING;
      this._xhr({
        method: 'GET',
        sync: false
      }, function (result) {
        return _this3._loadResult(result);
      });
    }
  }, {
    key: '_loadResult',
    value: function _loadResult(result) {
      var _this4 = this;

      var prefix = this.constructor.eventPrefix;
      if (!result.success) {
        this.syncState = SYNC_STATE.NEW;
        this._triggerAsync(prefix + ':loaded-error', { error: result.data });
        setTimeout(function () {
          return _this4.destroy();
        }, 100); // Insure destroyed AFTER loaded-error event has triggered
      } else {
        this._populateFromServer(result.data);
        this._loaded(result.data);
        this.trigger(prefix + ':loaded');
      }
    }

    /**
     * Processing the result of a _load() call.
     *
     * Typically used to register the object and cleanup any properties not handled by _populateFromServer.
     *
     * @method _loaded
     * @private
     * @param  {Object} data - Response data from server
     */

  }, {
    key: '_loaded',
    value: function _loaded(data) {}

    /**
     * Object is new, and is queued for syncing, but does not yet exist on the server.
     *
     * That means it is currently out of sync with the server.
     *
     * @method _setSyncing
     * @private
     */

  }, {
    key: '_setSyncing',
    value: function _setSyncing() {
      this._clearObject();
      switch (this.syncState) {
        case SYNC_STATE.SYNCED:
          this.syncState = SYNC_STATE.SYNCING;
          break;
        case SYNC_STATE.NEW:
          this.syncState = SYNC_STATE.SAVING;
          break;
      }
      this._syncCounter++;
    }

    /**
     * Object is synced with the server and up to date.
     *
     * @method _setSynced
     * @private
     */

  }, {
    key: '_setSynced',
    value: function _setSynced() {
      this._clearObject();
      if (this._syncCounter > 0) this._syncCounter--;

      this.syncState = this._syncCounter === 0 ? SYNC_STATE.SYNCED : SYNC_STATE.SYNCING;
      this.isSending = false;
    }

    /**
     * Any time the instance changes, we should clear the cached toObject value
     *
     * @method _clearObject
     * @private
     */

  }, {
    key: '_clearObject',
    value: function _clearObject() {
      this._toObject = null;
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Syncable instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this object.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Syncable.prototype.__proto__ || Object.getPrototypeOf(Syncable.prototype), 'toObject', this).call(this);
        this._toObject.isNew = this.isNew();
        this._toObject.isSaving = this.isSaving();
        this._toObject.isSaved = this.isSaved();
        this._toObject.isSynced = this.isSynced();
      }
      return this._toObject;
    }

    /**
     * Object is new, and is not yet queued for syncing
     *
     * @method isNew
     * @returns {boolean}
     */

  }, {
    key: 'isNew',
    value: function isNew() {
      return this.syncState === SYNC_STATE.NEW;
    }

    /**
     * Object is new, and is queued for syncing
     *
     * @method isSaving
     * @returns {boolean}
     */

  }, {
    key: 'isSaving',
    value: function isSaving() {
      return this.syncState === SYNC_STATE.SAVING;
    }

    /**
     * Object exists on server.
     *
     * @method isSaved
     * @returns {boolean}
     */

  }, {
    key: 'isSaved',
    value: function isSaved() {
      return !(this.isNew() || this.isSaving());
    }

    /**
     * Object is fully synced.
     *
     * As best we know, server and client have the same values.
     *
     * @method isSynced
     * @returns {boolean}
     */

  }, {
    key: 'isSynced',
    value: function isSynced() {
      return this.syncState === SYNC_STATE.SYNCED;
    }
  }], [{
    key: 'load',
    value: function load(id, client) {
      if (!client || !(client instanceof Root)) throw new Error(LayerError.dictionary.clientMissing);

      var obj = {
        id: id,
        url: client.url + id.substring(8),
        clientId: client.appId
      };

      var ConstructorClass = Syncable.subclasses.filter(function (aClass) {
        return obj.id.indexOf(aClass.prefixUUID) === 0;
      })[0];
      var syncItem = new ConstructorClass(obj);
      var typeName = ConstructorClass.eventPrefix;

      if (typeName) {
        client.dbManager.getObject(typeName, id, function (item) {
          if (syncItem.isDestroyed) return;
          if (item) {
            syncItem._populateFromServer(item);
            syncItem.trigger(typeName + ':loaded');
          } else {
            syncItem._load();
          }
        });
      } else {
        syncItem._load();
      }

      syncItem.syncState = SYNC_STATE.LOADING;
      return syncItem;
    }
  }]);

  return Syncable;
}(Root);

/**
 * Unique identifier.
 *
 * @type {string}
 */


Syncable.prototype.id = '';

/**
 * URL to access the object on the server.
 *
 * @type {string}
 * @readonly
 * @protected
 */
Syncable.prototype.url = '';

/**
 * The time that this client created this instance.
 *
 * This value is not tied to when it was first created on the server.  Creating a new instance
 * based on server data will result in a new `localCreateAt` value.
 *
 * @type {Date}
 */
Syncable.prototype.localCreatedAt = null;

/**
 * layer.Client that the object belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @protected
 * @readonly
 */
Syncable.prototype.clientId = '';

/**
 * Temporary property indicating that the instance was loaded from local database rather than server.
 *
 * @type {boolean}
 * @private
 */
Syncable.prototype._fromDB = false;

/**
 * The current sync state of this object.
 *
 * Possible values are:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @type {string}
 */
Syncable.prototype.syncState = SYNC_STATE.NEW;

/**
 * Number of sync requests that have been requested.
 *
 * Counts down to zero; once it reaches zero, all sync
 * requests have been completed.
 *
 * @type {Number}
 * @private
 */
Syncable.prototype._syncCounter = 0;

/**
 * Prefix to use when triggering events
 * @private
 * @static
 */
Syncable.eventPrefix = '';

Syncable.enableOpsIfNew = false;

/**
 * Is the object loading from the server?
 *
 * @type {boolean}
 */
Object.defineProperty(Syncable.prototype, 'isLoading', {
  enumerable: true,
  get: function get() {
    return this.syncState === SYNC_STATE.LOADING;
  }
});

/**
 * Array of classes that are subclasses of Syncable.
 *
 * Used by Factory function.
 * @private
 */
Syncable.subclasses = [];

Syncable._supportedEvents = [].concat(Root._supportedEvents);
Syncable.inObjectIgnore = Root.inObjectIgnore;
module.exports = Syncable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jYWJsZS5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIlNZTkNfU1RBVEUiLCJMYXllckVycm9yIiwiQ2xpZW50UmVnaXN0cnkiLCJDb25zdGFudHMiLCJTeW5jYWJsZSIsIm9wdGlvbnMiLCJsb2NhbENyZWF0ZWRBdCIsIkRhdGUiLCJnZXQiLCJjbGllbnRJZCIsImNhbGxiYWNrIiwidXJsIiwibWV0aG9kIiwiY2xpZW50IiwiZ2V0Q2xpZW50IiwiaXNEZXN0cm95ZWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiY29uc3RydWN0b3IiLCJlbmFibGVPcHNJZk5ldyIsInN5bmNTdGF0ZSIsIk5FVyIsIm1hdGNoIiwic3luYyIsIl9zZXR1cFN5bmNPYmplY3QiLCJfc2V0U3luY2luZyIsInhociIsInJlc3VsdCIsInN1Y2Nlc3MiLCJfc2V0U3luY2VkIiwidGFyZ2V0IiwiaWQiLCJkYXRhIiwiX2RlbGV0ZWQiLCJkZXN0cm95IiwidHJpZ2dlciIsImV2ZW50UHJlZml4IiwiTE9BRElORyIsIl94aHIiLCJfbG9hZFJlc3VsdCIsInByZWZpeCIsIl90cmlnZ2VyQXN5bmMiLCJlcnJvciIsInNldFRpbWVvdXQiLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwiX2xvYWRlZCIsIl9jbGVhck9iamVjdCIsIlNZTkNFRCIsIlNZTkNJTkciLCJTQVZJTkciLCJfc3luY0NvdW50ZXIiLCJpc1NlbmRpbmciLCJfdG9PYmplY3QiLCJpc05ldyIsImlzU2F2aW5nIiwiaXNTYXZlZCIsImlzU3luY2VkIiwib2JqIiwic3Vic3RyaW5nIiwiYXBwSWQiLCJDb25zdHJ1Y3RvckNsYXNzIiwic3ViY2xhc3NlcyIsImZpbHRlciIsImluZGV4T2YiLCJhQ2xhc3MiLCJwcmVmaXhVVUlEIiwic3luY0l0ZW0iLCJ0eXBlTmFtZSIsImRiTWFuYWdlciIsImdldE9iamVjdCIsIml0ZW0iLCJfbG9hZCIsInByb3RvdHlwZSIsIl9mcm9tREIiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiaW5PYmplY3RJZ25vcmUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxJQUFNQSxPQUFPQyxRQUFRLFFBQVIsQ0FBYjs7ZUFDdUJBLFFBQVEsU0FBUixDO0lBQWZDLFUsWUFBQUEsVTs7QUFDUixJQUFNQyxhQUFhRixRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNRyxpQkFBaUJILFFBQVEsbUJBQVIsQ0FBdkI7QUFDQSxJQUFNSSxZQUFZSixRQUFRLFNBQVIsQ0FBbEI7O0lBRU1LLFE7OztBQUNKLHNCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFBQSxvSEFDbEJBLE9BRGtCOztBQUV4QixVQUFLQyxjQUFMLEdBQXNCLElBQUlDLElBQUosRUFBdEI7QUFGd0I7QUFHekI7O0FBRUQ7Ozs7Ozs7Ozs7Z0NBTVk7QUFDVixhQUFPTCxlQUFlTSxHQUFmLENBQW1CLEtBQUtDLFFBQXhCLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O3lCQVNLSixPLEVBQVNLLFEsRUFBVTtBQUFBOztBQUN0QjtBQUNBLFVBQUksQ0FBQ0wsUUFBUU0sR0FBYixFQUFrQk4sUUFBUU0sR0FBUixHQUFjLEVBQWQ7QUFDbEIsVUFBSSxDQUFDTixRQUFRTyxNQUFiLEVBQXFCUCxRQUFRTyxNQUFSLEdBQWlCLEtBQWpCO0FBQ3JCLFVBQU1DLFNBQVMsS0FBS0MsU0FBTCxFQUFmOztBQUVBO0FBQ0EsVUFBSSxLQUFLQyxXQUFULEVBQXNCLE1BQU0sSUFBSUMsS0FBSixDQUFVZixXQUFXZ0IsVUFBWCxDQUFzQkYsV0FBaEMsQ0FBTjtBQUN0QixVQUFJLENBQUNGLE1BQUwsRUFBYSxNQUFNLElBQUlHLEtBQUosQ0FBVWYsV0FBV2dCLFVBQVgsQ0FBc0JDLGFBQWhDLENBQU47QUFDYixVQUFJLENBQUMsS0FB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QVQsR0FBMEJsRixLQUFLa0YsY0FBL0I7QUFDQUMsT0FBT0MsT0FBUCxHQUFpQjlFLFFBQWpCIiwiZmlsZSI6InN5bmNhYmxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgU3luY2FibGUgYWJzdHJhY3QgY2xhcyByZXByZXNlbnRzIHJlc291cmNlcyB0aGF0IGFyZSBzeW5jYWJsZSB3aXRoIHRoZSBzZXJ2ZXIuXG4gKiBUaGlzIGlzIGN1cnJlbnRseSB1c2VkIGZvciBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucy5cbiAqIEl0IHJlcHJlc2VudHMgdGhlIHN0YXRlIG9mIHRoZSBvYmplY3QncyBzeW5jLCBhcyBvbmUgb2Y6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXOiBOZXdseSBjcmVhdGVkOyBsb2NhbCBvbmx5LlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU0FWSU5HOiBOZXdseSBjcmVhdGVkOyBiZWluZyBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNJTkc6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyLCBidXQgY2hhbmdlcyBhcmUgYmVpbmcgc2VudCB0byBzZXJ2ZXIuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TWU5DRUQ6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyIGFuZCBpcyBzeW5jZWQuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5MT0FESU5HOiBFeGlzdHMgb24gc2VydmVyOyBsb2FkaW5nIGl0IGludG8gY2xpZW50LlxuICpcbiAqIEBjbGFzcyBsYXllci5TeW5jYWJsZVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQGFic3RyYWN0XG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgeyBTWU5DX1NUQVRFIH0gPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuL2NsaWVudC1yZWdpc3RyeScpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuXG5jbGFzcyBTeW5jYWJsZSBleHRlbmRzIFJvb3Qge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmxvY2FsQ3JlYXRlZEF0ID0gbmV3IERhdGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGNsaWVudCBhc3NvY2lhdGVkIHdpdGggdGhpcyBPYmplY3QuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLkNsaWVudH1cbiAgICovXG4gIGdldENsaWVudCgpIHtcbiAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpcmUgYW4gWEhSIHJlcXVlc3QgdXNpbmcgdGhlIFVSTCBmb3IgdGhpcyByZXNvdXJjZS5cbiAgICpcbiAgICogRm9yIG1vcmUgaW5mbyBvbiB4aHIgbWV0aG9kIHBhcmFtZXRlcnMgc2VlIHtAbGluayBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yI3hocn1cbiAgICpcbiAgICogQG1ldGhvZCBfeGhyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHJldHVybiB7bGF5ZXIuU3luY2FibGV9IHRoaXNcbiAgICovXG4gIF94aHIob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAvLyBpbml0aWFsaXplXG4gICAgaWYgKCFvcHRpb25zLnVybCkgb3B0aW9ucy51cmwgPSAnJztcbiAgICBpZiAoIW9wdGlvbnMubWV0aG9kKSBvcHRpb25zLm1ldGhvZCA9ICdHRVQnO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICAvLyBWYWxpZGF0YXRpb25cbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pc0Rlc3Ryb3llZCk7XG4gICAgaWYgKCFjbGllbnQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG4gICAgaWYgKCF0aGlzLmNvbnN0cnVjdG9yLmVuYWJsZU9wc0lmTmV3ICYmXG4gICAgICBvcHRpb25zLm1ldGhvZCAhPT0gJ1BPU1QnICYmIG9wdGlvbnMubWV0aG9kICE9PSAnR0VUJyAmJlxuICAgICAgdGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAoIW9wdGlvbnMudXJsLm1hdGNoKC9eaHR0cChzKTpcXC9cXC8vKSkge1xuICAgICAgaWYgKG9wdGlvbnMudXJsICYmICFvcHRpb25zLnVybC5tYXRjaCgvXihcXC98XFw/KS8pKSBvcHRpb25zLnVybCA9ICcvJyArIG9wdGlvbnMudXJsO1xuICAgICAgaWYgKCFvcHRpb25zLnN5bmMpIG9wdGlvbnMudXJsID0gdGhpcy51cmwgKyBvcHRpb25zLnVybDtcbiAgICB9XG5cbiAgICAvLyBTZXR1cCBzeW5jIHN0cnVjdHVyZVxuICAgIG9wdGlvbnMuc3luYyA9IHRoaXMuX3NldHVwU3luY09iamVjdChvcHRpb25zLnN5bmMpO1xuXG4gICAgaWYgKG9wdGlvbnMubWV0aG9kICE9PSAnR0VUJykge1xuICAgICAgdGhpcy5fc2V0U3luY2luZygpO1xuICAgIH1cblxuICAgIGNsaWVudC54aHIob3B0aW9ucywgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzICYmIG9wdGlvbnMubWV0aG9kICE9PSAnR0VUJyAmJiAhdGhpcy5pc0Rlc3Ryb3llZCkge1xuICAgICAgICB0aGlzLl9zZXRTeW5jZWQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzdWx0KTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXR1cCBhbiBvYmplY3QgdG8gcGFzcyBpbiB0aGUgYHN5bmNgIHBhcmFtZXRlciBmb3IgYW55IHN5bmMgcmVxdWVzdHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3NldHVwU3luY09iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gc3luYyAtIEtub3duIHBhcmFtZXRlcnMgb2YgdGhlIHN5bmMgb2JqZWN0IHRvIGJlIHJldHVybmVkOyBvciBudWxsLlxuICAgKiBAcmV0dXJuIHtPYmplY3R9IGZsZXNoZWQgb3V0IHN5bmMgb2JqZWN0XG4gICAqL1xuICBfc2V0dXBTeW5jT2JqZWN0KHN5bmMpIHtcbiAgICBpZiAoc3luYyAhPT0gZmFsc2UpIHtcbiAgICAgIGlmICghc3luYykgc3luYyA9IHt9O1xuICAgICAgaWYgKCFzeW5jLnRhcmdldCkgc3luYy50YXJnZXQgPSB0aGlzLmlkO1xuICAgIH1cbiAgICByZXR1cm4gc3luYztcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHdlYnNvY2tldCBldmVudCBoYXMgYmVlbiByZWNlaXZlZCBzcGVjaWZ5aW5nIHRoYXQgdGhpcyByZXNvdXJjZVxuICAgKiBoYXMgYmVlbiBkZWxldGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIGhhbmRsZVdlYnNvY2tldERlbGV0ZVxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXG4gICAqL1xuICBfaGFuZGxlV2Vic29ja2V0RGVsZXRlKGRhdGEpIHtcbiAgICB0aGlzLl9kZWxldGVkKCk7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIE9iamVjdCBoYXMgYmVlbiBkZWxldGVkLlxuICAgKlxuICAgKiBEZXN0cm95IG11c3QgYmUgY2FsbGVkIHNlcGFyYXRlbHksIGFuZCBoYW5kbGVzIG1vc3QgY2xlYW51cC5cbiAgICpcbiAgICogQG1ldGhvZCBfZGVsZXRlZFxuICAgKiBAcHJvdGVjdGVkXG4gICAqL1xuICBfZGVsZXRlZCgpIHtcbiAgICB0aGlzLnRyaWdnZXIodGhpcy5jb25zdHJ1Y3Rvci5ldmVudFByZWZpeCArICc6ZGVsZXRlJyk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBMb2FkIHRoZSByZXNvdXJjZSBpZGVudGlmaWVkIHZpYSBhIExheWVyIElELlxuICAgKlxuICAgKiBXaWxsIGxvYWQgdGhlIHJlcXVlc3RlZCByZXNvdXJjZSBmcm9tIHBlcnNpc3RlbmNlIG9yIHNlcnZlciBhcyBuZWVkZWQsXG4gICAqIGFuZCB0cmlnZ2VyIGB0eXBlLW5hbWU6bG9hZGVkYCB3aGVuIGl0cyBsb2FkZWQuICBJbnN0YW5jZSByZXR1cm5lZCBieSB0aGlzXG4gICAqIG1ldGhvZCB3aWxsIGhhdmUgb25seSBJRCBhbmQgVVJMIHByb3BlcnRpZXMsIGFsbCBvdGhlcnMgYXJlIHVuc2V0IHVudGlsXG4gICAqIHRoZSBgY29udmVyc2F0aW9uczpsb2FkZWRgLCBgbWVzc2FnZXM6bG9hZGVkYCwgZXRjLi4uIGV2ZW50IGhhcyBmaXJlZC5cbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBtZXNzYWdlID0gbGF5ZXIuTWVzc2FnZS5sb2FkKG1lc3NhZ2VJZCwgY2xpZW50KTtcbiAgICogbWVzc2FnZS5vbmNlKCdtZXNzYWdlczpsb2FkZWQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgYWxlcnQoXCJNZXNzYWdlIGxvYWRlZFwiKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gaWQgLSBgbGF5ZXI6Ly8vbWVzc2FnZXMvVVVJRGBcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5TeW5jYWJsZX0gLSBSZXR1cm5zIGFuIGVtcHR5IG9iamVjdCB0aGF0IHdpbGwgYmUgcG9wdWxhdGVkIG9uY2UgZGF0YSBpcyBsb2FkZWQuXG4gICAqL1xuICBzdGF0aWMgbG9hZChpZCwgY2xpZW50KSB7XG4gICAgaWYgKCFjbGllbnQgfHwgIShjbGllbnQgaW5zdGFuY2VvZiBSb290KSkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcblxuICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgIGlkLFxuICAgICAgdXJsOiBjbGllbnQudXJsICsgaWQuc3Vic3RyaW5nKDgpLFxuICAgICAgY2xpZW50SWQ6IGNsaWVudC5hcHBJZCxcbiAgICB9O1xuXG4gICAgY29uc3QgQ29uc3RydWN0b3JDbGFzcyA9IFN5bmNhYmxlLnN1YmNsYXNzZXMuZmlsdGVyKGFDbGFzcyA9PiBvYmouaWQuaW5kZXhPZihhQ2xhc3MucHJlZml4VVVJRCkgPT09IDApWzBdO1xuICAgIGNvbnN0IHN5bmNJdGVtID0gbmV3IENvbnN0cnVjdG9yQ2xhc3Mob2JqKTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IENvbnN0cnVjdG9yQ2xhc3MuZXZlbnRQcmVmaXg7XG5cbiAgICBpZiAodHlwZU5hbWUpIHtcbiAgICAgIGNsaWVudC5kYk1hbmFnZXIuZ2V0T2JqZWN0KHR5cGVOYW1lLCBpZCwgKGl0ZW0pID0+IHtcbiAgICAgICAgaWYgKHN5bmNJdGVtLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgICAgc3luY0l0ZW0uX3BvcHVsYXRlRnJvbVNlcnZlcihpdGVtKTtcbiAgICAgICAgICBzeW5jSXRlbS50cmlnZ2VyKHR5cGVOYW1lICsgJzpsb2FkZWQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzeW5jSXRlbS5fbG9hZCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3luY0l0ZW0uX2xvYWQoKTtcbiAgICB9XG5cbiAgICBzeW5jSXRlbS5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gICAgcmV0dXJuIHN5bmNJdGVtO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgdGhpcyByZXNvdXJjZSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBmcm9tIHRoZSBzdGF0aWMgbGF5ZXIuU3luY2FibGUubG9hZCgpIG1ldGhvZFxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbG9hZCgpIHtcbiAgICB0aGlzLnN5bmNTdGF0ZSA9IFNZTkNfU1RBVEUuTE9BRElORztcbiAgICB0aGlzLl94aHIoe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHN5bmM6IGZhbHNlLFxuICAgIH0sIHJlc3VsdCA9PiB0aGlzLl9sb2FkUmVzdWx0KHJlc3VsdCkpO1xuICB9XG5cblxuICBfbG9hZFJlc3VsdChyZXN1bHQpIHtcbiAgICBjb25zdCBwcmVmaXggPSB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4O1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5ORVc7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMocHJlZml4ICsgJzpsb2FkZWQtZXJyb3InLCB7IGVycm9yOiByZXN1bHQuZGF0YSB9KTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5kZXN0cm95KCksIDEwMCk7IC8vIEluc3VyZSBkZXN0cm95ZWQgQUZURVIgbG9hZGVkLWVycm9yIGV2ZW50IGhhcyB0cmlnZ2VyZWRcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKHJlc3VsdC5kYXRhKTtcbiAgICAgIHRoaXMuX2xvYWRlZChyZXN1bHQuZGF0YSk7XG4gICAgICB0aGlzLnRyaWdnZXIocHJlZml4ICsgJzpsb2FkZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2Vzc2luZyB0aGUgcmVzdWx0IG9mIGEgX2xvYWQoKSBjYWxsLlxuICAgKlxuICAgKiBUeXBpY2FsbHkgdXNlZCB0byByZWdpc3RlciB0aGUgb2JqZWN0IGFuZCBjbGVhbnVwIGFueSBwcm9wZXJ0aWVzIG5vdCBoYW5kbGVkIGJ5IF9wb3B1bGF0ZUZyb21TZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgLSBSZXNwb25zZSBkYXRhIGZyb20gc2VydmVyXG4gICAqL1xuICBfbG9hZGVkKGRhdGEpIHtcblxuICB9XG5cbiAgLyoqXG4gICAqIE9iamVjdCBpcyBuZXcsIGFuZCBpcyBxdWV1ZWQgZm9yIHN5bmNpbmcsIGJ1dCBkb2VzIG5vdCB5ZXQgZXhpc3Qgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogVGhhdCBtZWFucyBpdCBpcyBjdXJyZW50bHkgb3V0IG9mIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXRTeW5jaW5nXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc2V0U3luY2luZygpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN3aXRjaCAodGhpcy5zeW5jU3RhdGUpIHtcbiAgICAgIGNhc2UgU1lOQ19TVEFURS5TWU5DRUQ6XG4gICAgICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5TWU5DSU5HO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU1lOQ19TVEFURS5ORVc6XG4gICAgICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5TQVZJTkc7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICB0aGlzLl9zeW5jQ291bnRlcisrO1xuICB9XG5cbiAgLyoqXG4gICAqIE9iamVjdCBpcyBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIGFuZCB1cCB0byBkYXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXRTeW5jZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zZXRTeW5jZWQoKSB7XG4gICAgdGhpcy5fY2xlYXJPYmplY3QoKTtcbiAgICBpZiAodGhpcy5fc3luY0NvdW50ZXIgPiAwKSB0aGlzLl9zeW5jQ291bnRlci0tO1xuXG4gICAgdGhpcy5zeW5jU3RhdGUgPSB0aGlzLl9zeW5jQ291bnRlciA9PT0gMCA/IFNZTkNfU1RBVEUuU1lOQ0VEIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgU1lOQ19TVEFURS5TWU5DSU5HO1xuICAgIHRoaXMuaXNTZW5kaW5nID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogQW55IHRpbWUgdGhlIGluc3RhbmNlIGNoYW5nZXMsIHdlIHNob3VsZCBjbGVhciB0aGUgY2FjaGVkIHRvT2JqZWN0IHZhbHVlXG4gICAqXG4gICAqIEBtZXRob2QgX2NsZWFyT2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYXJPYmplY3QoKSB7XG4gICAgdGhpcy5fdG9PYmplY3QgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwbGFpbiBvYmplY3QuXG4gICAqXG4gICAqIE9iamVjdCB3aWxsIGhhdmUgYWxsIHRoZSBzYW1lIHB1YmxpYyBwcm9wZXJ0aWVzIGFzIHRoaXNcbiAgICogU3luY2FibGUgaW5zdGFuY2UuICBOZXcgb2JqZWN0IGlzIHJldHVybmVkIGFueSB0aW1lXG4gICAqIGFueSBvZiB0aGlzIG9iamVjdCdzIHByb3BlcnRpZXMgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gUE9KTyB2ZXJzaW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgKi9cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QuaXNOZXcgPSB0aGlzLmlzTmV3KCk7XG4gICAgICB0aGlzLl90b09iamVjdC5pc1NhdmluZyA9IHRoaXMuaXNTYXZpbmcoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0LmlzU2F2ZWQgPSB0aGlzLmlzU2F2ZWQoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0LmlzU3luY2VkID0gdGhpcy5pc1N5bmNlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fdG9PYmplY3Q7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIG5ldywgYW5kIGlzIG5vdCB5ZXQgcXVldWVkIGZvciBzeW5jaW5nXG4gICAqXG4gICAqIEBtZXRob2QgaXNOZXdcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqL1xuICBpc05ldygpIHtcbiAgICByZXR1cm4gdGhpcy5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTkVXO1xuICB9XG5cbiAgLyoqXG4gICAqIE9iamVjdCBpcyBuZXcsIGFuZCBpcyBxdWV1ZWQgZm9yIHN5bmNpbmdcbiAgICpcbiAgICogQG1ldGhvZCBpc1NhdmluZ1xuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzU2F2aW5nKCkge1xuICAgIHJldHVybiB0aGlzLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkc7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGV4aXN0cyBvbiBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgaXNTYXZlZFxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzU2F2ZWQoKSB7XG4gICAgcmV0dXJuICEodGhpcy5pc05ldygpIHx8IHRoaXMuaXNTYXZpbmcoKSk7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIGZ1bGx5IHN5bmNlZC5cbiAgICpcbiAgICogQXMgYmVzdCB3ZSBrbm93LCBzZXJ2ZXIgYW5kIGNsaWVudCBoYXZlIHRoZSBzYW1lIHZhbHVlcy5cbiAgICpcbiAgICogQG1ldGhvZCBpc1N5bmNlZFxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzU3luY2VkKCkge1xuICAgIHJldHVybiB0aGlzLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TWU5DRUQ7XG4gIH1cbn1cblxuLyoqXG4gKiBVbmlxdWUgaWRlbnRpZmllci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuaWQgPSAnJztcblxuLyoqXG4gKiBVUkwgdG8gYWNjZXNzIHRoZSBvYmplY3Qgb24gdGhlIHNlcnZlci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKiBAcHJvdGVjdGVkXG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS51cmwgPSAnJztcblxuLyoqXG4gKiBUaGUgdGltZSB0aGF0IHRoaXMgY2xpZW50IGNyZWF0ZWQgdGhpcyBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIHZhbHVlIGlzIG5vdCB0aWVkIHRvIHdoZW4gaXQgd2FzIGZpcnN0IGNyZWF0ZWQgb24gdGhlIHNlcnZlci4gIENyZWF0aW5nIGEgbmV3IGluc3RhbmNlXG4gKiBiYXNlZCBvbiBzZXJ2ZXIgZGF0YSB3aWxsIHJlc3VsdCBpbiBhIG5ldyBgbG9jYWxDcmVhdGVBdGAgdmFsdWUuXG4gKlxuICogQHR5cGUge0RhdGV9XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5sb2NhbENyZWF0ZWRBdCA9IG51bGw7XG5cblxuLyoqXG4gKiBsYXllci5DbGllbnQgdGhhdCB0aGUgb2JqZWN0IGJlbG9uZ3MgdG8uXG4gKlxuICogQWN0dWFsIHZhbHVlIG9mIHRoaXMgc3RyaW5nIG1hdGNoZXMgdGhlIGFwcElkLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBwcm90ZWN0ZWRcbiAqIEByZWFkb25seVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuLyoqXG4gKiBUZW1wb3JhcnkgcHJvcGVydHkgaW5kaWNhdGluZyB0aGF0IHRoZSBpbnN0YW5jZSB3YXMgbG9hZGVkIGZyb20gbG9jYWwgZGF0YWJhc2UgcmF0aGVyIHRoYW4gc2VydmVyLlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuU3luY2FibGUucHJvdG90eXBlLl9mcm9tREIgPSBmYWxzZTtcblxuLyoqXG4gKiBUaGUgY3VycmVudCBzeW5jIHN0YXRlIG9mIHRoaXMgb2JqZWN0LlxuICpcbiAqIFBvc3NpYmxlIHZhbHVlcyBhcmU6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXOiBOZXdseSBjcmVhdGVkOyBsb2NhbCBvbmx5LlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU0FWSU5HOiBOZXdseSBjcmVhdGVkOyBiZWluZyBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNJTkc6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyLCBidXQgY2hhbmdlcyBhcmUgYmVpbmcgc2VudCB0byBzZXJ2ZXIuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TWU5DRUQ6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyIGFuZCBpcyBzeW5jZWQuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5MT0FESU5HOiBFeGlzdHMgb24gc2VydmVyOyBsb2FkaW5nIGl0IGludG8gY2xpZW50LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLk5FVztcblxuLyoqXG4gKiBOdW1iZXIgb2Ygc3luYyByZXF1ZXN0cyB0aGF0IGhhdmUgYmVlbiByZXF1ZXN0ZWQuXG4gKlxuICogQ291bnRzIGRvd24gdG8gemVybzsgb25jZSBpdCByZWFjaGVzIHplcm8sIGFsbCBzeW5jXG4gKiByZXF1ZXN0cyBoYXZlIGJlZW4gY29tcGxldGVkLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuX3N5bmNDb3VudGVyID0gMDtcblxuLyoqXG4gKiBQcmVmaXggdG8gdXNlIHdoZW4gdHJpZ2dlcmluZyBldmVudHNcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKi9cblN5bmNhYmxlLmV2ZW50UHJlZml4ID0gJyc7XG5cblN5bmNhYmxlLmVuYWJsZU9wc0lmTmV3ID0gZmFsc2U7XG5cbi8qKlxuICogSXMgdGhlIG9iamVjdCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlcj9cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFN5bmNhYmxlLnByb3RvdHlwZSwgJ2lzTG9hZGluZycsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBBcnJheSBvZiBjbGFzc2VzIHRoYXQgYXJlIHN1YmNsYXNzZXMgb2YgU3luY2FibGUuXG4gKlxuICogVXNlZCBieSBGYWN0b3J5IGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuU3luY2FibGUuc3ViY2xhc3NlcyA9IFtdO1xuXG5TeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzID0gW10uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5TeW5jYWJsZS5pbk9iamVjdElnbm9yZSA9IFJvb3QuaW5PYmplY3RJZ25vcmU7XG5tb2R1bGUuZXhwb3J0cyA9IFN5bmNhYmxlO1xuIl19
