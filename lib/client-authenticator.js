'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Layer Client.  Access the layer by calling create and receiving it
 * from the "ready" callback.

  var client = new layer.Client({
    appId: "layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff",
    isTrustedDevice: false,
    challenge: function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    },
    ready: function(client) {
      alert("Yay, I finally got my client!");
    }
  }).connect("sampleuserId");

 * The Layer Client/ClientAuthenticator classes have been divided into:
 *
 * 1. ClientAuthenticator: Manages all authentication and connectivity related issues
 * 2. Client: Manages access to Conversations, Queries, Messages, Events, etc...
 *
 * @class layer.ClientAuthenticator
 * @private
 * @extends layer.Root
 * @author Michael Kantor
 *
 */

var xhr = require('./xhr');
var Root = require('./root');
var SocketManager = require('./websockets/socket-manager');
var WebsocketChangeManager = require('./websockets/change-manager');
var WebsocketRequestManager = require('./websockets/request-manager');
var LayerError = require('./layer-error');
var OnlineManager = require('./online-state-manager');
var SyncManager = require('./sync-manager');
var DbManager = require('./db-manager');
var Identity = require('./identity');

var _require = require('./sync-event'),
    XHRSyncEvent = _require.XHRSyncEvent,
    WebsocketSyncEvent = _require.WebsocketSyncEvent;

var _require2 = require('./const'),
    ACCEPT = _require2.ACCEPT,
    LOCALSTORAGE_KEYS = _require2.LOCALSTORAGE_KEYS;

var logger = require('./logger');
var Util = require('./client-utils');

var MAX_XHR_RETRIES = 3;

var ClientAuthenticator = function (_Root) {
  _inherits(ClientAuthenticator, _Root);

  /**
   * Create a new Client.
   *
   * The appId is the only required parameter:
   *
   *      var client = new Client({
   *          appId: "layer:///apps/staging/uuid"
   *      });
   *
   * For trusted devices, you can enable storage of data to indexedDB and localStorage with the `isTrustedDevice` and `isPersistenceEnabled` property:
   *
   *      var client = new Client({
   *          appId: "layer:///apps/staging/uuid",
   *          isTrustedDevice: true,
   *          isPersistenceEnabled: true
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {string} options.appId           - "layer:///apps/production/uuid"; Identifies what
   *                                            application we are connecting to.
   * @param  {string} [options.url=https://api.layer.com] - URL to log into a different REST server
   * @param {number} [options.logLevel=ERROR] - Provide a log level that is one of layer.Constants.LOG.NONE, layer.Constants.LOG.ERROR,
   *                                            layer.Constants.LOG.WARN, layer.Constants.LOG.INFO, layer.Constants.LOG.DEBUG
   * @param {boolean} [options.isTrustedDevice=false] - If this is not a trusted device, no data will be written to indexedDB nor localStorage,
   *                                            regardless of any values in layer.Client.persistenceFeatures.
   * @param {Object} [options.isPersistenceEnabled=false] If layer.Client.isPersistenceEnabled is true, then indexedDB will be used to manage a cache
   *                                            allowing Query results, messages sent, and all local modifications to be persisted between page reloads.
   */
  function ClientAuthenticator(options) {
    _classCallCheck(this, ClientAuthenticator);

    // Validate required parameters
    if (!options.appId) throw new Error(LayerError.dictionary.appIdMissing);

    return _possibleConstructorReturn(this, (ClientAuthenticator.__proto__ || Object.getPrototypeOf(ClientAuthenticator)).call(this, options));
  }

  /**
   * Initialize the subcomponents of the ClientAuthenticator
   *
   * @method _initComponents
   * @private
   */


  _createClass(ClientAuthenticator, [{
    key: '_initComponents',
    value: function _initComponents() {
      // Setup the websocket manager; won't connect until we trigger an authenticated event
      this.socketManager = new SocketManager({
        client: this
      });

      this.socketChangeManager = new WebsocketChangeManager({
        client: this,
        socketManager: this.socketManager
      });

      this.socketRequestManager = new WebsocketRequestManager({
        client: this,
        socketManager: this.socketManager
      });

      this.onlineManager = new OnlineManager({
        socketManager: this.socketManager,
        testUrl: this.url + '/nonces?connection-test',
        connected: this._handleOnlineChange.bind(this),
        disconnected: this._handleOnlineChange.bind(this)
      });

      this.syncManager = new SyncManager({
        onlineManager: this.onlineManager,
        socketManager: this.socketManager,
        requestManager: this.socketRequestManager,
        client: this
      });
    }

    /**
     * Destroy the subcomponents of the ClientAuthenticator
     *
     * @method _destroyComponents
     * @private
     */

  }, {
    key: '_destroyComponents',
    value: function _destroyComponents() {
      this.syncManager.destroy();
      this.onlineManager.destroy();
      this.socketManager.destroy();
      this.socketChangeManager.destroy();
      this.socketRequestManager.destroy();
      if (this.dbManager) this.dbManager.destroy();
    }

    /**
     * Is Persisted Session Tokens disabled?
     *
     * @method _isPersistedSessionsDisabled
     * @returns {Boolean}
     * @private
     */

  }, {
    key: '_isPersistedSessionsDisabled',
    value: function _isPersistedSessionsDisabled() {
      return !global.localStorage || this.persistenceFeatures && !this.persistenceFeatures.sessionToken;
    }

    /**
     * Restore the sessionToken from localStorage.
     *
     * This sets the sessionToken rather than returning the token.
     *
     * @method _restoreLastSession
     * @private
     */

  }, {
    key: '_restoreLastSession',
    value: function _restoreLastSession() {
      if (this._isPersistedSessionsDisabled()) return;
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return;
        var parsedData = JSON.parse(sessionData);
        if (parsedData.expires < Date.now()) {
          global.localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        } else {
          this.sessionToken = parsedData.sessionToken;
        }
      } catch (error) {
        // No-op
      }
    }

    /**
       * Restore the Identity for the session owner from localStorage.
       *
       * @method _restoreLastSession
       * @private
       * @return {layer.Identity}
       */

  }, {
    key: '_restoreLastUser',
    value: function _restoreLastUser() {
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return null;
        var userObj = JSON.parse(sessionData).user;
        return new Identity({
          clientId: this.appId,
          sessionOwner: true,
          fromServer: userObj
        });
      } catch (error) {
        return null;
      }
    }

    /**
     * Has the userID changed since the last login?
     *
     * @method _hasUserIdChanged
     * @param {string} userId
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_hasUserIdChanged',
    value: function _hasUserIdChanged(userId) {
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return true;
        return JSON.parse(sessionData).user.user_id !== userId;
      } catch (error) {
        return true;
      }
    }

    /**
     * Initiates the connection.
     *
     * Called by constructor().
     *
     * Will either attempt to validate the cached sessionToken by getting converations,
     * or if no sessionToken, will call /nonces to start process of getting a new one.
     *
     * ```javascript
     * var client = new layer.Client({appId: myAppId});
     * client.connect('Frodo-the-Dodo');
     * ```
     *
     * @method connect
     * @param {string} userId - User ID of the user you are logging in as
     * @returns {layer.ClientAuthenticator} this
     */

  }, {
    key: 'connect',
    value: function connect() {
      var _this2 = this;

      var userId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      var user = void 0;
      this.isConnected = false;
      this.user = null;
      this.onlineManager.start();
      if (!this.isTrustedDevice || !userId || this._isPersistedSessionsDisabled() || this._hasUserIdChanged(userId)) {
        this._clearStoredData();
      }

      if (this.isTrustedDevice && userId) {
        this._restoreLastSession(userId);
        user = this._restoreLastUser();
        if (user) this.user = user;
      }

      if (!this.user) {
        this.user = new Identity({
          userId: userId,
          sessionOwner: true,
          clientId: this.appId,
          id: userId ? Identity.prefixUUID + encodeURIComponent(userId) : ''
        });
      }

      if (this.sessionToken && this.user.userId) {
        this._sessionTokenRestored();
      } else {
        this.xhr({
          url: '/nonces',
          method: 'POST',
          sync: false
        }, function (result) {
          return _this2._connectionResponse(result);
        });
      }
      return this;
    }

    /**
     * Initiates the connection with a session token.
     *
     * This call is for use when you have received a Session Token from some other source; such as your server,
     * and wish to use that instead of doing a full auth process.
     *
     * The Client will presume the token to be valid, and will asynchronously trigger the `ready` event.
     * If the token provided is NOT valid, this won't be detected until a request is made using this token,
     * at which point the `challenge` method will trigger.
     *
     * NOTE: The `connected` event will not be triggered on this path.
     *
     * ```javascript
     * var client = new layer.Client({appId: myAppId});
     * client.connectWithSession('Frodo-the-Dodo', mySessionToken);
     * ```
     *
     * @method connectWithSession
     * @param {String} userId
     * @param {String} sessionToken
     * @returns {layer.ClientAuthenticator} this
     */

  }, {
    key: 'connectWithSession',
    value: function connectWithSession(userId, sessionToken) {
      var _this3 = this;

      var user = void 0;
      this.user = null;
      if (!userId || !sessionToken) throw new Error(LayerError.dictionary.sessionAndUserRequired);
      if (!this.isTrustedDevice || this._isPersistedSessionsDisabled() || this._hasUserIdChanged(userId)) {
        this._clearStoredData();
      }
      if (this.isTrustedDevice) {
        user = this._restoreLastUser();
        if (user) this.user = user;
      }

      this.onlineManager.start();

      if (!this.user) {
        this.user = new Identity({
          userId: userId,
          sessionOwner: true,
          clientId: this.appId,
          id: Identity.prefixUUID + encodeURIComponent(userId)
        });
      }

      this.isConnected = true;
      setTimeout(function () {
        return _this3._authComplete({ session_token: sessionToken }, false);
      }, 1);
      return this;
    }

    /**
     * Called when our request for a nonce gets a response.
     *
     * If there is an error, calls _connectionError.
     *
     * If there is nonce, calls _connectionComplete.
     *
     * @method _connectionResponse
     * @private
     * @param  {Object} result
     */

  }, {
    key: '_connectionResponse',
    value: function _connectionResponse(result) {
      if (!result.success) {
        this._connectionError(result.data);
      } else {
        this._connectionComplete(result.data);
      }
    }

    /**
     * We are now connected (we have a nonce).
     *
     * If we have successfully retrieved a nonce, then
     * we have entered a "connected" but not "authenticated" state.
     * Set the state, trigger any events, and then start authentication.
     *
     * @method _connectionComplete
     * @private
     * @param  {Object} result
     * @param  {string} result.nonce - The nonce provided by the server
     *
     * @fires connected
     */

  }, {
    key: '_connectionComplete',
    value: function _connectionComplete(result) {
      this.isConnected = true;
      this.trigger('connected');
      this._authenticate(result.nonce);
    }

    /**
     * Called when we fail to get a nonce.
     *
     * @method _connectionError
     * @private
     * @param  {layer.LayerError} err
     *
     * @fires connected-error
     */

  }, {
    key: '_connectionError',
    value: function _connectionError(error) {
      this.trigger('connected-error', { error: error });
    }

    /* CONNECT METHODS END */

    /* AUTHENTICATE METHODS BEGIN */

    /**
     * Start the authentication step.
     *
     * We start authentication by triggering a "challenge" event that
     * tells the app to use the nonce to obtain an identity_token.
     *
     * @method _authenticate
     * @private
     * @param  {string} nonce - The nonce to provide your identity provider service
     *
     * @fires challenge
     */

  }, {
    key: '_authenticate',
    value: function _authenticate(nonce) {
      if (nonce) {
        this.trigger('challenge', {
          nonce: nonce,
          callback: this.answerAuthenticationChallenge.bind(this)
        });
      }
    }

    /**
     * Accept an identityToken and use it to create a session.
     *
     * Typically, this method is called using the function pointer provided by
     * the challenge event, but it can also be called directly.
     *
     *      getIdentityToken(nonce, function(identityToken) {
     *          client.answerAuthenticationChallenge(identityToken);
     *      });
     *
     * @method answerAuthenticationChallenge
     * @param  {string} identityToken - Identity token provided by your identity provider service
     */

  }, {
    key: 'answerAuthenticationChallenge',
    value: function answerAuthenticationChallenge(identityToken) {
      var _this4 = this;

      // Report an error if no identityToken provided
      if (!identityToken) {
        throw new Error(LayerError.dictionary.identityTokenMissing);
      } else {
        var userData = Util.decode(identityToken.split('.')[1]);
        var identityObj = JSON.parse(userData);

        if (this.user.userId && this.user.userId !== identityObj.prn) throw new Error(LayerError.dictionary.invalidUserIdChange);

        this.user._setUserId(identityObj.prn);

        if (identityObj.display_name) this.user.displayName = identityObj.display_name;
        if (identityObj.avatar_url) this.user.avatarUrl = identityObj.avatar_url;

        this.xhr({
          url: '/sessions',
          method: 'POST',
          sync: false,
          data: {
            identity_token: identityToken,
            app_id: this.appId
          }
        }, function (result) {
          return _this4._authResponse(result, identityToken);
        });
      }
    }

    /**
     * Called when our request for a sessionToken receives a response.
     *
     * @private
     * @method _authResponse
     * @param  {Object} result
     * @param  {string} identityToken
     */

  }, {
    key: '_authResponse',
    value: function _authResponse(result, identityToken) {
      if (!result.success) {
        this._authError(result.data, identityToken);
      } else {
        this._authComplete(result.data, false);
      }
    }

    /**
     * Authentication is completed, update state and trigger events.
     *
     * @method _authComplete
     * @private
     * @param  {Object} result
     * @param  {Boolean} fromPersistence
     * @param  {string} result.session_token - Session token received from the server
     *
     * @fires authenticated
     */

  }, {
    key: '_authComplete',
    value: function _authComplete(result, fromPersistence) {
      if (!result || !result.session_token) {
        throw new Error(LayerError.dictionary.sessionTokenMissing);
      }
      this.sessionToken = result.session_token;

      // If _authComplete was called because we accepted an auth loaded from storage
      // we don't need to update storage.
      if (!this._isPersistedSessionsDisabled() && !fromPersistence) {
        try {
          global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId] = JSON.stringify({
            sessionToken: this.sessionToken || '',
            user: DbManager.prototype._getIdentityData([this.user], true)[0],
            expires: Date.now() + 30 * 60 * 60 * 24 * 1000
          });
        } catch (e) {
          // Do nothing
        }
      }

      this._clientAuthenticated();
    }

    /**
     * Authentication has failed.
     *
     * @method _authError
     * @private
     * @param  {layer.LayerError} result
     * @param  {string} identityToken Not currently used
     *
     * @fires authenticated-error
     */

  }, {
    key: '_authError',
    value: function _authError(error, identityToken) {
      this.trigger('authenticated-error', { error: error });
    }

    /**
     * Sets state and triggers events for both connected and authenticated.
     *
     * If reusing a sessionToken cached in localStorage,
     * use this method rather than _authComplete.
     *
     * @method _sessionTokenRestored
     * @private
     *
     * @fires connected, authenticated
     */

  }, {
    key: '_sessionTokenRestored',
    value: function _sessionTokenRestored() {
      this.isConnected = true;
      this.trigger('connected');
      this._clientAuthenticated();
    }

    /**
     * The client is now authenticated, and doing some setup
     * before calling _clientReady.
     *
     * @method _clientAuthenticated
     * @private
     */

  }, {
    key: '_clientAuthenticated',
    value: function _clientAuthenticated() {
      var _this5 = this;

      // Update state and trigger the event
      this.isAuthenticated = true;
      this.trigger('authenticated');

      if (!this.isTrustedDevice) this.isPersistenceEnabled = false;

      // If no persistenceFeatures are specified, set them all
      // to true or false to match isTrustedDevice.
      if (!this.persistenceFeatures || !this.isPersistenceEnabled) {
        var sessionToken = void 0;
        if (this.persistenceFeatures && 'sessionToken' in this.persistenceFeatures) {
          sessionToken = Boolean(this.persistenceFeatures.sessionToken);
        } else {
          sessionToken = this.isTrustedDevice;
        }
        this.persistenceFeatures = {
          conversations: this.isPersistenceEnabled,
          messages: this.isPersistenceEnabled,
          syncQueue: this.isPersistenceEnabled,
          sessionToken: sessionToken
        };
      }

      // Setup the Database Manager
      if (!this.dbManager) {
        this.dbManager = new DbManager({
          client: this,
          tables: this.persistenceFeatures
        });
      }

      // Before calling _clientReady, load the session owner's full Identity.
      if (this.isPersistenceEnabled) {
        this.dbManager.onOpen(function () {
          return _this5._loadUser();
        });
      } else {
        this._loadUser();
      }
    }

    /**
     * Load the session owner's full identity.
     *
     * Note that failure to load the identity will not prevent
     * _clientReady, but is certainly not a desired outcome.
     *
     * @method _loadUser
     */

  }, {
    key: '_loadUser',
    value: function _loadUser() {
      var _this6 = this;

      // We're done if we got the full identity from localStorage.
      if (this.user.isFullIdentity) {
        this._clientReady();
      } else {
        // load the user's full Identity and update localStorage
        this.user._load();
        this.user.once('identities:loaded', function () {
          if (!_this6._isPersistedSessionsDisabled()) {
            try {
              // Update the session data in localStorage with our full Identity.
              var sessionData = JSON.parse(global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + _this6.appId]);
              sessionData.user = DbManager.prototype._getIdentityData([_this6.user])[0];
              global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + _this6.appId] = JSON.stringify(sessionData);
            } catch (e) {
              // no-op
            }
          }
          _this6._clientReady();
        }).once('identities:loaded-error', function () {
          if (!_this6.user.displayName) _this6.user.displayName = _this6.defaultOwnerDisplayName;
          _this6._clientReady();
        });
      }
    }

    /**
     * Called to flag the client as ready for action.
     *
     * This method is called after authenication AND
     * after initial conversations have been loaded.
     *
     * @method _clientReady
     * @private
     * @fires ready
     */

  }, {
    key: '_clientReady',
    value: function _clientReady() {
      if (!this.isReady) {
        this.isReady = true;
        this.trigger('ready');
      }
    }

    /* CONNECT METHODS END */

    /* START SESSION MANAGEMENT METHODS */

    /**
     * Deletes your sessionToken from the server, and removes all user data from the Client.
     * Call `client.connect()` to restart the authentication process.
     *
     * This call is asynchronous; some browsers (ahem, safari...) may not have completed the deletion of
     * persisted data if you
     * navigate away from the page.  Use the callback to determine when all necessary cleanup has completed
     * prior to navigating away.
     *
     * Note that while all data should be purged from the browser/device, if you are offline when this is called,
     * your session token will NOT be deleted from the web server.  Why not? Because it would involve retaining the
     * request after all of the user's data has been deleted, or NOT deleting the user's data until we are online.
     *
     * @method logout
     * @param {Function} callback
     * @return {layer.ClientAuthenticator} this
     */

  }, {
    key: 'logout',
    value: function logout(callback) {
      var callbackCount = 1,
          counter = 0;
      if (this.isAuthenticated) {
        callbackCount++;
        this.xhr({
          method: 'DELETE',
          url: '/sessions/' + escape(this.sessionToken),
          sync: false
        }, function () {
          counter++;
          if (counter === callbackCount && callback) callback();
        });
      }

      // Clear data even if isAuthenticated is false
      // Session may have expired, but data still cached.
      this._clearStoredData(function () {
        counter++;
        if (counter === callbackCount && callback) callback();
      });

      this._resetSession();
      return this;
    }
  }, {
    key: '_clearStoredData',
    value: function _clearStoredData(callback) {
      if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
      if (this.dbManager) {
        this.dbManager.deleteTables(callback);
      } else if (callback) {
        callback();
      }
    }

    /**
     * Log out/clear session information.
     *
     * Use this to clear the sessionToken and all information from this session.
     *
     * @method _resetSession
     * @private
     */

  }, {
    key: '_resetSession',
    value: function _resetSession() {
      this.isReady = false;
      if (this.sessionToken) {
        this.sessionToken = '';
        if (global.localStorage) {
          localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        }
      }

      this.isConnected = false;
      this.isAuthenticated = false;

      this.trigger('deauthenticated');
      this.onlineManager.stop();
    }

    /**
     * Register your IOS device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method registerIOSPushToken
     * @param {Object} options
     * @param {string} options.deviceId - Your IOS device's device ID
     * @param {string} options.iosVersion - Your IOS device's version number
     * @param {string} options.token - Your Apple APNS Token
     * @param {string} [options.bundleId] - Your Apple APNS Bundle ID ("com.layer.bundleid")
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'registerIOSPushToken',
    value: function registerIOSPushToken(options, callback) {
      this.xhr({
        url: 'push_tokens',
        method: 'POST',
        sync: false,
        data: {
          token: options.token,
          type: 'apns',
          device_id: options.deviceId,
          ios_version: options.iosVersion,
          apns_bundle_id: options.bundleId
        }
      }, function (result) {
        return callback(result.data);
      });
    }

    /**
     * Register your Android device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method registerAndroidPushToken
     * @param {Object} options
     * @param {string} options.deviceId - Your IOS device's device ID
     * @param {string} options.token - Your GCM push Token
     * @param {string} options.senderId - Your GCM Sender ID/Project Number
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'registerAndroidPushToken',
    value: function registerAndroidPushToken(options, callback) {
      this.xhr({
        url: 'push_tokens',
        method: 'POST',
        sync: false,
        data: {
          token: options.token,
          type: 'gcm',
          device_id: options.deviceId,
          gcm_sender_id: options.senderId
        }
      }, function (result) {
        return callback(result.data);
      });
    }

    /**
     * Register your Android device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method unregisterPushToken
     * @param {string} deviceId - Your IOS device's device ID
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'unregisterPushToken',
    value: function unregisterPushToken(deviceId, callback) {
      this.xhr({
        url: 'push_tokens/' + deviceId,
        method: 'DELETE'
      }, function (result) {
        return callback(result.data);
      });
    }

    /* SESSION MANAGEMENT METHODS END */

    /* ACCESSOR METHODS BEGIN */

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.userAppId = 'xxx'` will cause an error to be thrown
     * if the client is already connected.
     *
     * @private
     * @method __adjustAppId
     * @param {string} value - New appId value
     */

  }, {
    key: '__adjustAppId',
    value: function __adjustAppId() {
      if (this.isConnected) throw new Error(LayerError.dictionary.cantChangeIfConnected);
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.user = userIdentity` will cause an error to be thrown
     * if the client is already connected.
     *
     * @private
     * @method __adjustUser
     * @param {string} user - new Identity object
     */

  }, {
    key: '__adjustUser',
    value: function __adjustUser(user) {
      if (this.isConnected) {
        throw new Error(LayerError.dictionary.cantChangeIfConnected);
      }
    }

    // Virtual methods

  }, {
    key: '_addIdentity',
    value: function _addIdentity(identity) {}
  }, {
    key: '_removeIdentity',
    value: function _removeIdentity(identity) {}

    /* ACCESSOR METHODS END */

    /* COMMUNICATIONS METHODS BEGIN */

  }, {
    key: 'sendSocketRequest',
    value: function sendSocketRequest(params, callback) {
      if (params.sync) {
        var target = params.sync.target;
        var depends = params.sync.depends;
        if (target && !depends) depends = [target];

        this.syncManager.request(new WebsocketSyncEvent({
          data: params.body,
          operation: params.method,
          target: target,
          depends: depends,
          callback: callback
        }));
      } else {
        if (typeof params.data === 'function') params.data = params.data();
        this.socketRequestManager.sendRequest(params, callback);
      }
    }

    /**
     * This event handler receives events from the Online State Manager and generates an event for those subscribed
     * to client.on('online')
     *
     * @method _handleOnlineChange
     * @private
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_handleOnlineChange',
    value: function _handleOnlineChange(evt) {
      if (!this.isAuthenticated) return;
      var duration = evt.offlineDuration;
      var isOnline = evt.eventName === 'connected';
      var obj = { isOnline: isOnline };
      if (isOnline) {
        obj.reset = duration > ClientAuthenticator.ResetAfterOfflineDuration;
      }
      this.trigger('online', obj);
    }

    /**
     * Main entry point for sending xhr requests or for queing them in the syncManager.
     *
     * This call adjust arguments for our REST server.
     *
     * @method xhr
     * @protected
     * @param  {Object}   options
     * @param  {string}   options.url - URL relative client's url: "/conversations"
     * @param  {Function} callback
     * @param  {Object}   callback.result
     * @param  {Mixed}    callback.result.data - If an error occurred, this is a layer.LayerError;
     *                                          If the response was application/json, this will be an object
     *                                          If the response was text/empty, this will be text/empty
     * @param  {XMLHttpRequest} callback.result.xhr - Native xhr request object for detailed analysis
     * @param  {Object}         callback.result.Links - Hash of Link headers
     * @return {layer.ClientAuthenticator} this
     */

  }, {
    key: 'xhr',
    value: function xhr(options, callback) {
      if (!options.sync || !options.sync.target) {
        options.url = this._xhrFixRelativeUrls(options.url || '');
      }

      options.withCredentials = true;
      if (!options.method) options.method = 'GET';
      if (!options.headers) options.headers = {};
      this._xhrFixHeaders(options.headers);
      this._xhrFixAuth(options.headers);

      // Note: this is not sync vs async; this is syncManager vs fire it now
      if (options.sync === false) {
        this._nonsyncXhr(options, callback, 0);
      } else {
        this._syncXhr(options, callback);
      }
      return this;
    }

    /**
     * For xhr calls that go through the sync manager, queue it up.
     *
     * @method _syncXhr
     * @private
     * @param  {Object}   options
     * @param  {Function} callback
     */

  }, {
    key: '_syncXhr',
    value: function _syncXhr(options, callback) {
      var _this7 = this;

      if (!options.sync) options.sync = {};
      var innerCallback = function innerCallback(result) {
        _this7._xhrResult(result, callback);
      };
      var target = options.sync.target;
      var depends = options.sync.depends;
      if (target && !depends) depends = [target];

      this.syncManager.request(new XHRSyncEvent({
        url: options.url,
        data: options.data,
        method: options.method,
        operation: options.sync.operation || options.method,
        headers: options.headers,
        callback: innerCallback,
        target: target,
        depends: depends
      }));
    }

    /**
     * For xhr calls that don't go through the sync manager,
     * fire the request, and if it fails, refire it up to 3 tries
     * before reporting an error.  1 second delay between requests
     * so whatever issue is occuring is a tiny bit more likely to resolve,
     * and so we don't hammer the server every time there's a problem.
     *
     * @method _nonsyncXhr
     * @private
     * @param  {Object}   options
     * @param  {Function} callback
     * @param  {number}   retryCount
     */

  }, {
    key: '_nonsyncXhr',
    value: function _nonsyncXhr(options, callback, retryCount) {
      var _this8 = this;

      xhr(options, function (result) {
        if ([502, 503, 504].indexOf(result.status) !== -1 && retryCount < MAX_XHR_RETRIES) {
          setTimeout(function () {
            return _this8._nonsyncXhr(options, callback, retryCount + 1);
          }, 1000);
        } else {
          _this8._xhrResult(result, callback);
        }
      });
    }

    /**
     * Fix authentication header for an xhr request
     *
     * @method _xhrFixAuth
     * @private
     * @param  {Object} headers
     */

  }, {
    key: '_xhrFixAuth',
    value: function _xhrFixAuth(headers) {
      if (this.sessionToken && !headers.Authorization) {
        headers.authorization = 'Layer session-token="' + this.sessionToken + '"'; // eslint-disable-line
      }
    }

    /**
     * Fix relative URLs to create absolute URLs needed for CORS requests.
     *
     * @method _xhrFixRelativeUrls
     * @private
     * @param  {string} relative or absolute url
     * @return {string} absolute url
     */

  }, {
    key: '_xhrFixRelativeUrls',
    value: function _xhrFixRelativeUrls(url) {
      var result = url;
      if (url.indexOf('https://') === -1) {
        if (url[0] === '/') {
          result = this.url + url;
        } else {
          result = this.url + '/' + url;
        }
      }
      return result;
    }

    /**
     * Fixup all headers in preparation for an xhr call.
     *
     * 1. All headers use lower case names for standard/easy lookup
     * 2. Set the accept header
     * 3. If needed, set the content-type header
     *
     * @method _xhrFixHeaders
     * @private
     * @param  {Object} headers
     */

  }, {
    key: '_xhrFixHeaders',
    value: function _xhrFixHeaders(headers) {
      // Replace all headers in arbitrary case with all lower case
      // for easy matching.
      var headerNameList = Object.keys(headers);
      headerNameList.forEach(function (headerName) {
        if (headerName !== headerName.toLowerCase()) {
          headers[headerName.toLowerCase()] = headers[headerName];
          delete headers[headerName];
        }
      });

      if (!headers.accept) headers.accept = ACCEPT;

      if (!headers['content-type']) headers['content-type'] = 'application/json';
    }

    /**
     * Handle the result of an xhr call
     *
     * @method _xhrResult
     * @private
     * @param  {Object}   result     Standard xhr response object from the xhr lib
     * @param  {Function} [callback] Callback on completion
     */

  }, {
    key: '_xhrResult',
    value: function _xhrResult(result, callback) {
      if (this.isDestroyed) return;

      if (!result.success) {
        // Replace the response with a LayerError instance
        if (result.data && _typeof(result.data) === 'object') {
          this._generateError(result);
        }

        // If its an authentication error, reauthenticate
        // don't call _resetSession as that wipes all data and screws with UIs, and the user
        // is still authenticated on the customer's app even if not on Layer.
        if (result.status === 401 && this.isAuthenticated) {
          logger.warn('SESSION EXPIRED!');
          this.isAuthenticated = false;
          if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
          this.trigger('deauthenticated');
          this._authenticate(result.data.getNonce());
        }
      }
      if (callback) callback(result);
    }

    /**
     * Transforms xhr error response into a layer.LayerError instance.
     *
     * Adds additional information to the result object including
     *
     * * url
     * * data
     *
     * @method _generateError
     * @private
     * @param  {Object} result - Result of the xhr call
     */

  }, {
    key: '_generateError',
    value: function _generateError(result) {
      result.data = new LayerError(result.data);
      if (!result.data.httpStatus) result.data.httpStatus = result.status;
      result.data.log();
    }

    /* END COMMUNICATIONS METHODS */

  }]);

  return ClientAuthenticator;
}(Root);

/**
 * State variable; indicates that client is currently authenticated by the server.
 * Should never be true if isConnected is false.
 * @type {Boolean}
 * @readonly
 */


ClientAuthenticator.prototype.isAuthenticated = false;

/**
 * State variable; indicates that client is currently connected to server
 * (may not be authenticated yet)
 * @type {Boolean}
 * @readonly
 */
ClientAuthenticator.prototype.isConnected = false;

/**
 * State variable; indicates that client is ready for the app to use.
 * Use the 'ready' event to be notified when this value changes to true.
 *
 * @type {boolean}
 * @readonly
 */
ClientAuthenticator.prototype.isReady = false;

/**
 * Your Layer Application ID. This value can not be changed once connected.
 * To find your Layer Application ID, see your Layer Developer Dashboard.
 *
 * @type {String}
 */
ClientAuthenticator.prototype.appId = '';

/**
 * Identity information about the authenticated user.
 *
 * @type {layer.Identity}
 */
ClientAuthenticator.prototype.user = null;

/**
 * Your current session token that authenticates your requests.
 *
 * @type {String}
 * @readonly
 */
ClientAuthenticator.prototype.sessionToken = '';

/**
 * URL to Layer's Web API server.
 *
 * Only muck with this if told to by Layer Staff.
 * @type {String}
 */
ClientAuthenticator.prototype.url = 'https://api.layer.com';

/**
 * URL to Layer's Websocket server.
 *
 * Only muck with this if told to by Layer Staff.
 * @type {String}
 */
ClientAuthenticator.prototype.websocketUrl = 'wss://websockets.layer.com';

/**
 * Web Socket Manager
 * @type {layer.Websockets.SocketManager}
 */
ClientAuthenticator.prototype.socketManager = null;

/**
 * Web Socket Request Manager
* @type {layer.Websockets.RequestManager}
 */
ClientAuthenticator.prototype.socketRequestManager = null;

/**
 * Web Socket Manager
 * @type {layer.Websockets.ChangeManager}
 */
ClientAuthenticator.prototype.socketChangeManager = null;

/**
 * Service for managing online as well as offline server requests
 * @type {layer.SyncManager}
 */
ClientAuthenticator.prototype.syncManager = null;

/**
 * Service for managing online/offline state and events
 * @type {layer.OnlineStateManager}
 */
ClientAuthenticator.prototype.onlineManager = null;

/**
 * If this is a trusted device, then we can write personal data to persistent memory.
 * @type {boolean}
 */
ClientAuthenticator.prototype.isTrustedDevice = false;

/**
 * To enable indexedDB storage of query data, set this true.  Experimental.
 *
 * @property {boolean}
 */
ClientAuthenticator.prototype.isPersistenceEnabled = false;

/**
 * If this layer.Client.isTrustedDevice is true, then you can control which types of data are persisted.
 *
 * Note that values here are ignored if `isPersistenceEnabled` hasn't been set to `true`.
 *
 * Properties of this Object can be:
 *
 * * identities: Write identities to indexedDB? This allows for faster initialization.
 * * conversations: Write conversations to indexedDB? This allows for faster rendering
 *                  of a Conversation List
 * * messages: Write messages to indexedDB? This allows for full offline access
 * * syncQueue: Write requests made while offline to indexedDB?  This allows the app
 *              to complete sending messages after being relaunched.
 * * sessionToken: Write the session token to localStorage for quick reauthentication on relaunching the app.
 *
 *      new layer.Client({
 *        isTrustedDevice: true,
 *        persistenceFeatures: {
 *          conversations: true,
 *          identities: true,
 *          messages: false,
 *          syncQueue: false,
 *          sessionToken: true
 *        }
 *      });
 *
 * @type {Object}
 */
ClientAuthenticator.prototype.persistenceFeatures = null;

/**
 * Database Manager for read/write to IndexedDB
 * @type {layer.DbManager}
 */
ClientAuthenticator.prototype.dbManager = null;

/**
 * If a display name is not loaded for the session owner, use this name.
 *
 * @type {string}
 */
ClientAuthenticator.prototype.defaultOwnerDisplayName = 'You';

/**
 * Is true if the client is authenticated and connected to the server;
 *
 * Typically used to determine if there is a connection to the server.
 *
 * Typically used in conjunction with the `online` event.
 *
 * @type {boolean}
 */
Object.defineProperty(ClientAuthenticator.prototype, 'isOnline', {
  enumerable: true,
  get: function get() {
    return this.onlineManager && this.onlineManager.isOnline;
  }
});

/**
 * Log levels; one of:
 *
 *    * layer.Constants.LOG.NONE
 *    * layer.Constants.LOG.ERROR
 *    * layer.Constants.LOG.WARN
 *    * layer.Constants.LOG.INFO
 *    * layer.Constants.LOG.DEBUG
 *
 * @type {number}
 */
Object.defineProperty(ClientAuthenticator.prototype, 'logLevel', {
  enumerable: false,
  get: function get() {
    return logger.level;
  },
  set: function set(value) {
    logger.level = value;
  }
});

/**
 * Short hand for getting the userId of the authenticated user.
 *
 * Could also just use client.user.userId
 *
 * @type {string} userId
 */
Object.defineProperty(ClientAuthenticator.prototype, 'userId', {
  enumerable: true,
  get: function get() {
    return this.user ? this.user.userId : '';
  },
  set: function set() {}
});

/**
 * Time to be offline after which we don't do a WebSocket Events.replay,
 * but instead just refresh all our Query data.  Defaults to 30 hours.
 *
 * @type {number}
 * @static
 */
ClientAuthenticator.ResetAfterOfflineDuration = 1000 * 60 * 60 * 30;

/**
 * List of events supported by this class
 * @static
 * @protected
 * @type {string[]}
 */
ClientAuthenticator._supportedEvents = [
/**
 * The client is ready for action
 *
 *      client.on('ready', function(evt) {
 *          renderMyUI();
 *      });
 *
 * @event
 */
'ready',

/**
 * Fired when connected to the server.
 * Currently just means we have a nonce.
 * Not recommended for typical applications.
 * @event connected
 */
'connected',

/**
 * Fired when unsuccessful in obtaining a nonce.
 *
 * Not recommended for typical applications.
 * @event connected-error
 * @param {Object} event
 * @param {layer.LayerError} event.error
 */
'connected-error',

/**
 * We now have a session and any requests we send aught to work.
 * Typically you should use the ready event instead of the authenticated event.
 * @event authenticated
 */
'authenticated',

/**
 * Failed to authenticate your client.
 *
 * Either your identity-token was invalid, or something went wrong
 * using your identity-token.
 *
 * @event authenticated-error
 * @param {Object} event
 * @param {layer.LayerError} event.error
 */
'authenticated-error',

/**
 * This event fires when a session has expired or when `layer.Client.logout` is called.
 * Typically, it is enough to subscribe to the challenge event
 * which will let you reauthenticate; typical applications do not need
 * to subscribe to this.
 *
 * @event deauthenticated
 */
'deauthenticated',

/**
 * @event challenge
 * Verify the user's identity.
 *
 * This event is where you verify that the user is who we all think the user is,
 * and provide an identity token to validate that.
 *
 * ```javascript
 * client.on('challenge', function(evt) {
 *    myGetIdentityForNonce(evt.nonce, function(identityToken) {
 *      evt.callback(identityToken);
 *    });
 * });
 * ```
 *
 * @param {Object} event
 * @param {string} event.nonce - A nonce for you to provide to your identity provider
 * @param {Function} event.callback - Call this once you have an identity-token
 * @param {string} event.callback.identityToken - Identity token provided by your identity provider service
 */
'challenge',

/**
 * @event session-terminated
 * If your session has been terminated in such a way as to prevent automatic reconnect,
 *
 * this event will fire.  Common scenario: user has two tabs open;
 * one tab the user logs out (or you call client.logout()).
 * The other tab will detect that the sessionToken has been removed,
 * and will terminate its session as well.  In this scenario we do not want
 * to automatically trigger a challenge and restart the login process.
 */
'session-terminated',

/**
 * @event online
 *
 * This event is used to detect when the client is online (connected to the server)
 * or offline (still able to accept API calls but no longer able to sync to the server).
 *
 *      client.on('online', function(evt) {
 *         if (evt.isOnline) {
 *             statusDiv.style.backgroundColor = 'green';
 *         } else {
 *             statusDiv.style.backgroundColor = 'red';
 *         }
 *      });
 *
 * @param {Object} event
 * @param {boolean} event.isOnline
 */
'online'].concat(Root._supportedEvents);

Root.initClass.apply(ClientAuthenticator, [ClientAuthenticator, 'ClientAuthenticator']);

module.exports = ClientAuthenticator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtYXV0aGVudGljYXRvci5qcyJdLCJuYW1lcyI6WyJ4aHIiLCJyZXF1aXJlIiwiUm9vdCIsIlNvY2tldE1hbmFnZXIiLCJXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyIiwiV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIiLCJMYXllckVycm9yIiwiT25saW5lTWFuYWdlciIsIlN5bmNNYW5hZ2VyIiwiRGJNYW5hZ2VyIiwiSWRlbnRpdHkiLCJYSFJTeW5jRXZlbnQiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJBQ0NFUFQiLCJMT0NBTFNUT1JBR0VfS0VZUyIsImxvZ2dlciIsIlV0aWwiLCJNQVhfWEhSX1JFVFJJRVMiLCJDbGllbnRBdXRoZW50aWNhdG9yIiwib3B0aW9ucyIsImFwcElkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiYXBwSWRNaXNzaW5nIiwic29ja2V0TWFuYWdlciIsImNsaWVudCIsInNvY2tldENoYW5nZU1hbmFnZXIiLCJzb2NrZXRSZXF1ZXN0TWFuYWdlciIsIm9ubGluZU1hbmFnZXIiLCJ0ZXN0VXJsIiwidXJsIiwiY29ubmVjdGVkIiwiX2hhbmRsZU9ubGluZUNoYW5nZSIsImJpbmQiLCJkaXNjb25uZWN0ZWQiLCJzeW5jTWFuYWdlciIsInJlcXVlc3RNYW5hZ2VyIiwiZGVzdHJveSIsImRiTWFuYWdlciIsImdsb2JhbCIsImxvY2FsU3RvcmFnZSIsInBlcnNpc3RlbmNlRmVhdHVyZXMiLCJzZXNzaW9uVG9rZW4iLCJfaXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkIiwic2Vzc2lvbkRhdGEiLCJTRVNTSU9OREFUQSIsInBhcnNlZERhdGEiLCJKU09OIiwicGFyc2UiLCJleHBpcmVzIiwiRGF0ZSIsIm5vdyIsInJlbW92ZUl0ZW0iLCJlcnJvciIsInVzZXJPYmoiLCJ1c2VyIiwiY2xpZW50SWQiLCJzZXNzaW9uT3duZXIiLCJmcm9tU2VydmVyIiwidXNlcklkIiwidXNlcl9pZCIsImlzQ29ubmVjdGVkIiwic3RhcnQiLCJpc1RydXN0ZWREZXZpY2UiLCJfaGFzVXNlcklkQ2hhbmdlZCIsIl9jbGVhclN0b3JlZERhdGEiLCJfcmVzdG9yZUxhc3RTZXNzaW9uIiwiX3Jlc3RvcmVMYXN0VXNlciIsImlkIiwicHJlZml4VVVJRCIsImVuY29kZVVSSUNvbXBvbmVudCIsIl9zZXNzaW9uVG9rZW5SZXN0b3JlZCIsIm1ldGhvZCIsInN5bmMiLCJyZXN1bHQiLCJfY29ubmVjdGlvblJlc3BvbnNlIiwic2Vzc2lvbkFuZFVzZXJSZXF1aXJlZCIsInNldFRpbWVvdXQiLCJfYXV0aENvbXBsZXRlIiwic2Vzc2lvbl90b2tlbiIsInN1Y2Nlc3MiLCJfY29ubmVjdGlvbkVycm9yIiwiZGF0YSIsIl9jb25uZWN0aW9uQ29tcGxldGUiLCJ0cmlnZ2VyIiwiX2F1dGhlbnRpY2F0ZSIsIm5vbmNlIiwiY2FsbGJhY2siLCJhbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZSIsImlkZW50aXR5VG9rZW4iLCJpZGVudGl0eVRva2VuTWlzc2luZyIsInVzZXJEYXRhIiwiZGVjb2RlIiwic3BsaXQiLCJpZGVudGl0eU9iaiIsInBybiIsImludmFsaWRVc2VySWRDaGFuZ2UiLCJfc2V0VXNlcklkIiwiZGlzcGxheV9uYW1lIiwiZGlzcGxheU5hbWUiLCJhdmF0YXJfdXJsIiwiYXZhdGFyVXJsIiwiaWRlbnRpdHlfdG9rZW4iLCJhcHBfaWQiLCJfYXV0aFJlc3BvbnNlIiwiX2F1dGhFcnJvciIsImZyb21QZXJzaXN0ZW5jZSIsInNlc3Npb25Ub2tlbk1pc3NpbmciLCJzdHJpbmdpZnkiLCJwcm90b3R5cGUiLCJfZ2V0SWRlbnRpdHlEYXRhIiwiZSIsIl9jbGllbnRBdXRoZW50aWNhdGVkIiwiaXNBdXRoZW50aWNhdGVkIiwiaXNQZXJzaXN0ZW5jZUVuYWJsZWQiLCJCb29sZWFuIiwiY29udmVyc2F0aW9ucyIsIm1lc3NhZ2VzIiwic3luY1F1ZXVlIiwidGFibGVzIiwib25PcGVuIiwiX2xvYWRVc2VyIiwiaXNGdWxsSWRlbnRpdHkiLCJfY2xpZW50UmVhZHkiLCJfbG9hZCIsIm9uY2UiLCJkZWZhdWx0T3duZXJEaXNwbGF5TmFtZSIsImlzUmVhZHkiLCJjYWxsYmFja0NvdW50IiwiY291bnRlciIsImVzY2FwZSIsIl9yZXNldFNlc3Npb24iLCJkZWxldGVUYWJsZXMiLCJzdG9wIiwidG9rZW4iLCJ0eXBlIiwiZGV2aWNlX2lkIiwiZGV2aWNlSWQiLCJpb3NfdmVyc2lvbiIsImlvc1ZlcnNpb24iLCJhcG5zX2J1bmRsZV9pZCIsImJ1bmRsZUlkIiwiZ2NtX3NlbmRlcl9pZCIsInNlbmRlcklkIiwiY2FudENoYW5nZUlmQ29ubmVjdGVkIiwiaWRlbnRpdHkiLCJwYXJhbXMiLCJ0YXJnZXQiLCJkZXBlbmRzIiwicmVxdWVzdCIsImJvZHkiLCJvcGVyYXRpb24iLCJzZW5kUmVxdWVzdCIsImV2dCIsImR1cmF0aW9uIiwib2ZmbGluZUR1cmF0aW9uIiwiaXNPbmxpbmUiLCJldmVudE5hbWUiLCJvYmoiLCJyZXNldCIsIlJlc2V0QWZ0ZXJPZmZsaW5lRHVyYXRpb24iLCJfeGhyRml4UmVsYXRpdmVVcmxzIiwid2l0aENyZWRlbnRpYWxzIiwiaGVhZGVycyIsIl94aHJGaXhIZWFkZXJzIiwiX3hockZpeEF1dGgiLCJfbm9uc3luY1hociIsIl9zeW5jWGhyIiwiaW5uZXJDYWxsYmFjayIsIl94aHJSZXN1bHQiLCJyZXRyeUNvdW50IiwiaW5kZXhPZiIsInN0YXR1cyIsIkF1dGhvcml6YXRpb24iLCJhdXRob3JpemF0aW9uIiwiaGVhZGVyTmFtZUxpc3QiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImhlYWRlck5hbWUiLCJ0b0xvd2VyQ2FzZSIsImFjY2VwdCIsImlzRGVzdHJveWVkIiwiX2dlbmVyYXRlRXJyb3IiLCJ3YXJuIiwiZ2V0Tm9uY2UiLCJodHRwU3RhdHVzIiwibG9nIiwid2Vic29ja2V0VXJsIiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiZ2V0IiwibGV2ZWwiLCJzZXQiLCJ2YWx1ZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQi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QSxlQW5DcUM7O0FBcUNyQzs7Ozs7Ozs7OztBQVVBLHFCQS9DcUM7O0FBaURyQzs7Ozs7Ozs7QUFRQSxpQkF6RHFDOztBQTJEckM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBLFdBL0VxQzs7QUFpRnJDOzs7Ozs7Ozs7O0FBVUEsb0JBM0ZxQzs7QUE2RnJDOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSxRQTlHcUMsRUErR3JDQyxNQS9HcUMsQ0ErRzlCbE0sS0FBS2lNLGdCQS9HeUIsQ0FBdkM7O0FBaUhBak0sS0FBS21NLFNBQUwsQ0FBZUMsS0FBZixDQUFxQnBMLG1CQUFyQixFQUEwQyxDQUFDQSxtQkFBRCxFQUFzQixxQkFBdEIsQ0FBMUM7O0FBRUFxTCxPQUFPQyxPQUFQLEdBQWlCdEwsbUJBQWpCIiwiZmlsZSI6ImNsaWVudC1hdXRoZW50aWNhdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMYXllciBDbGllbnQuICBBY2Nlc3MgdGhlIGxheWVyIGJ5IGNhbGxpbmcgY3JlYXRlIGFuZCByZWNlaXZpbmcgaXRcbiAqIGZyb20gdGhlIFwicmVhZHlcIiBjYWxsYmFjay5cblxuICB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7XG4gICAgYXBwSWQ6IFwibGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZlwiLFxuICAgIGlzVHJ1c3RlZERldmljZTogZmFsc2UsXG4gICAgY2hhbGxlbmdlOiBmdW5jdGlvbihldnQpIHtcbiAgICAgIG15QXV0aGVudGljYXRvcih7XG4gICAgICAgIG5vbmNlOiBldnQubm9uY2UsXG4gICAgICAgIG9uU3VjY2VzczogZXZ0LmNhbGxiYWNrXG4gICAgICB9KTtcbiAgICB9LFxuICAgIHJlYWR5OiBmdW5jdGlvbihjbGllbnQpIHtcbiAgICAgIGFsZXJ0KFwiWWF5LCBJIGZpbmFsbHkgZ290IG15IGNsaWVudCFcIik7XG4gICAgfVxuICB9KS5jb25uZWN0KFwic2FtcGxldXNlcklkXCIpO1xuXG4gKiBUaGUgTGF5ZXIgQ2xpZW50L0NsaWVudEF1dGhlbnRpY2F0b3IgY2xhc3NlcyBoYXZlIGJlZW4gZGl2aWRlZCBpbnRvOlxuICpcbiAqIDEuIENsaWVudEF1dGhlbnRpY2F0b3I6IE1hbmFnZXMgYWxsIGF1dGhlbnRpY2F0aW9uIGFuZCBjb25uZWN0aXZpdHkgcmVsYXRlZCBpc3N1ZXNcbiAqIDIuIENsaWVudDogTWFuYWdlcyBhY2Nlc3MgdG8gQ29udmVyc2F0aW9ucywgUXVlcmllcywgTWVzc2FnZXMsIEV2ZW50cywgZXRjLi4uXG4gKlxuICogQGNsYXNzIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3JcbiAqIEBwcml2YXRlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYXV0aG9yIE1pY2hhZWwgS2FudG9yXG4gKlxuICovXG5cbmNvbnN0IHhociA9IHJlcXVpcmUoJy4veGhyJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBTb2NrZXRNYW5hZ2VyID0gcmVxdWlyZSgnLi93ZWJzb2NrZXRzL3NvY2tldC1tYW5hZ2VyJyk7XG5jb25zdCBXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyID0gcmVxdWlyZSgnLi93ZWJzb2NrZXRzL2NoYW5nZS1tYW5hZ2VyJyk7XG5jb25zdCBXZWJzb2NrZXRSZXF1ZXN0TWFuYWdlciA9IHJlcXVpcmUoJy4vd2Vic29ja2V0cy9yZXF1ZXN0LW1hbmFnZXInKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJyk7XG5jb25zdCBPbmxpbmVNYW5hZ2VyID0gcmVxdWlyZSgnLi9vbmxpbmUtc3RhdGUtbWFuYWdlcicpO1xuY29uc3QgU3luY01hbmFnZXIgPSByZXF1aXJlKCcuL3N5bmMtbWFuYWdlcicpO1xuY29uc3QgRGJNYW5hZ2VyID0gcmVxdWlyZSgnLi9kYi1tYW5hZ2VyJyk7XG5jb25zdCBJZGVudGl0eSA9IHJlcXVpcmUoJy4vaWRlbnRpdHknKTtcbmNvbnN0IHsgWEhSU3luY0V2ZW50LCBXZWJzb2NrZXRTeW5jRXZlbnQgfSA9IHJlcXVpcmUoJy4vc3luYy1ldmVudCcpO1xuY29uc3QgeyBBQ0NFUFQsIExPQ0FMU1RPUkFHRV9LRVlTIH0gPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5cbmNvbnN0IE1BWF9YSFJfUkVUUklFUyA9IDM7XG5cbmNsYXNzIENsaWVudEF1dGhlbnRpY2F0b3IgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IENsaWVudC5cbiAgICpcbiAgICogVGhlIGFwcElkIGlzIHRoZSBvbmx5IHJlcXVpcmVkIHBhcmFtZXRlcjpcbiAgICpcbiAgICogICAgICB2YXIgY2xpZW50ID0gbmV3IENsaWVudCh7XG4gICAqICAgICAgICAgIGFwcElkOiBcImxheWVyOi8vL2FwcHMvc3RhZ2luZy91dWlkXCJcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogRm9yIHRydXN0ZWQgZGV2aWNlcywgeW91IGNhbiBlbmFibGUgc3RvcmFnZSBvZiBkYXRhIHRvIGluZGV4ZWREQiBhbmQgbG9jYWxTdG9yYWdlIHdpdGggdGhlIGBpc1RydXN0ZWREZXZpY2VgIGFuZCBgaXNQZXJzaXN0ZW5jZUVuYWJsZWRgIHByb3BlcnR5OlxuICAgKlxuICAgKiAgICAgIHZhciBjbGllbnQgPSBuZXcgQ2xpZW50KHtcbiAgICogICAgICAgICAgYXBwSWQ6IFwibGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL3V1aWRcIixcbiAgICogICAgICAgICAgaXNUcnVzdGVkRGV2aWNlOiB0cnVlLFxuICAgKiAgICAgICAgICBpc1BlcnNpc3RlbmNlRW5hYmxlZDogdHJ1ZVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9wdGlvbnMuYXBwSWQgICAgICAgICAgIC0gXCJsYXllcjovLy9hcHBzL3Byb2R1Y3Rpb24vdXVpZFwiOyBJZGVudGlmaWVzIHdoYXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uIHdlIGFyZSBjb25uZWN0aW5nIHRvLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IFtvcHRpb25zLnVybD1odHRwczovL2FwaS5sYXllci5jb21dIC0gVVJMIHRvIGxvZyBpbnRvIGEgZGlmZmVyZW50IFJFU1Qgc2VydmVyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5sb2dMZXZlbD1FUlJPUl0gLSBQcm92aWRlIGEgbG9nIGxldmVsIHRoYXQgaXMgb25lIG9mIGxheWVyLkNvbnN0YW50cy5MT0cuTk9ORSwgbGF5ZXIuQ29uc3RhbnRzLkxPRy5FUlJPUixcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLkNvbnN0YW50cy5MT0cuV0FSTiwgbGF5ZXIuQ29uc3RhbnRzLkxPRy5JTkZPLCBsYXllci5Db25zdGFudHMuTE9HLkRFQlVHXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaXNUcnVzdGVkRGV2aWNlPWZhbHNlXSAtIElmIHRoaXMgaXMgbm90IGEgdHJ1c3RlZCBkZXZpY2UsIG5vIGRhdGEgd2lsbCBiZSB3cml0dGVuIHRvIGluZGV4ZWREQiBub3IgbG9jYWxTdG9yYWdlLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVnYXJkbGVzcyBvZiBhbnkgdmFsdWVzIGluIGxheWVyLkNsaWVudC5wZXJzaXN0ZW5jZUZlYXR1cmVzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQ9ZmFsc2VdIElmIGxheWVyLkNsaWVudC5pc1BlcnNpc3RlbmNlRW5hYmxlZCBpcyB0cnVlLCB0aGVuIGluZGV4ZWREQiB3aWxsIGJlIHVzZWQgdG8gbWFuYWdlIGEgY2FjaGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93aW5nIFF1ZXJ5IHJlc3VsdHMsIG1lc3NhZ2VzIHNlbnQsIGFuZCBhbGwgbG9jYWwgbW9kaWZpY2F0aW9ucyB0byBiZSBwZXJzaXN0ZWQgYmV0d2VlbiBwYWdlIHJlbG9hZHMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgLy8gVmFsaWRhdGUgcmVxdWlyZWQgcGFyYW1ldGVyc1xuICAgIGlmICghb3B0aW9ucy5hcHBJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5hcHBJZE1pc3NpbmcpO1xuXG4gICAgc3VwZXIob3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB0aGUgc3ViY29tcG9uZW50cyBvZiB0aGUgQ2xpZW50QXV0aGVudGljYXRvclxuICAgKlxuICAgKiBAbWV0aG9kIF9pbml0Q29tcG9uZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2luaXRDb21wb25lbnRzKCkge1xuICAgIC8vIFNldHVwIHRoZSB3ZWJzb2NrZXQgbWFuYWdlcjsgd29uJ3QgY29ubmVjdCB1bnRpbCB3ZSB0cmlnZ2VyIGFuIGF1dGhlbnRpY2F0ZWQgZXZlbnRcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIgPSBuZXcgU29ja2V0TWFuYWdlcih7XG4gICAgICBjbGllbnQ6IHRoaXMsXG4gICAgfSk7XG5cbiAgICB0aGlzLnNvY2tldENoYW5nZU1hbmFnZXIgPSBuZXcgV2Vic29ja2V0Q2hhbmdlTWFuYWdlcih7XG4gICAgICBjbGllbnQ6IHRoaXMsXG4gICAgICBzb2NrZXRNYW5hZ2VyOiB0aGlzLnNvY2tldE1hbmFnZXIsXG4gICAgfSk7XG5cbiAgICB0aGlzLnNvY2tldFJlcXVlc3RNYW5hZ2VyID0gbmV3IFdlYnNvY2tldFJlcXVlc3RNYW5hZ2VyKHtcbiAgICAgIGNsaWVudDogdGhpcyxcbiAgICAgIHNvY2tldE1hbmFnZXI6IHRoaXMuc29ja2V0TWFuYWdlcixcbiAgICB9KTtcblxuICAgIHRoaXMub25saW5lTWFuYWdlciA9IG5ldyBPbmxpbmVNYW5hZ2VyKHtcbiAgICAgIHNvY2tldE1hbmFnZXI6IHRoaXMuc29ja2V0TWFuYWdlcixcbiAgICAgIHRlc3RVcmw6IHRoaXMudXJsICsgJy9ub25jZXM/Y29ubmVjdGlvbi10ZXN0JyxcbiAgICAgIGNvbm5lY3RlZDogdGhpcy5faGFuZGxlT25saW5lQ2hhbmdlLmJpbmQodGhpcyksXG4gICAgICBkaXNjb25uZWN0ZWQ6IHRoaXMuX2hhbmRsZU9ubGluZUNoYW5nZS5iaW5kKHRoaXMpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zeW5jTWFuYWdlciA9IG5ldyBTeW5jTWFuYWdlcih7XG4gICAgICBvbmxpbmVNYW5hZ2VyOiB0aGlzLm9ubGluZU1hbmFnZXIsXG4gICAgICBzb2NrZXRNYW5hZ2VyOiB0aGlzLnNvY2tldE1hbmFnZXIsXG4gICAgICByZXF1ZXN0TWFuYWdlcjogdGhpcy5zb2NrZXRSZXF1ZXN0TWFuYWdlcixcbiAgICAgIGNsaWVudDogdGhpcyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXN0cm95IHRoZSBzdWJjb21wb25lbnRzIG9mIHRoZSBDbGllbnRBdXRoZW50aWNhdG9yXG4gICAqXG4gICAqIEBtZXRob2QgX2Rlc3Ryb3lDb21wb25lbnRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZGVzdHJveUNvbXBvbmVudHMoKSB7XG4gICAgdGhpcy5zeW5jTWFuYWdlci5kZXN0cm95KCk7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc29ja2V0Q2hhbmdlTWFuYWdlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zb2NrZXRSZXF1ZXN0TWFuYWdlci5kZXN0cm95KCk7XG4gICAgaWYgKHRoaXMuZGJNYW5hZ2VyKSB0aGlzLmRiTWFuYWdlci5kZXN0cm95KCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBJcyBQZXJzaXN0ZWQgU2Vzc2lvbiBUb2tlbnMgZGlzYWJsZWQ/XG4gICAqXG4gICAqIEBtZXRob2QgX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZFxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSB7XG4gICAgcmV0dXJuICFnbG9iYWwubG9jYWxTdG9yYWdlIHx8IHRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcyAmJiAhdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzLnNlc3Npb25Ub2tlbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXN0b3JlIHRoZSBzZXNzaW9uVG9rZW4gZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAqXG4gICAqIFRoaXMgc2V0cyB0aGUgc2Vzc2lvblRva2VuIHJhdGhlciB0aGFuIHJldHVybmluZyB0aGUgdG9rZW4uXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc3RvcmVMYXN0U2Vzc2lvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc3RvcmVMYXN0U2Vzc2lvbigpIHtcbiAgICBpZiAodGhpcy5faXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm47XG4gICAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShzZXNzaW9uRGF0YSk7XG4gICAgICBpZiAocGFyc2VkRGF0YS5leHBpcmVzIDwgRGF0ZS5ub3coKSkge1xuICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2Vzc2lvblRva2VuID0gcGFyc2VkRGF0YS5zZXNzaW9uVG9rZW47XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE5vLW9wXG4gICAgfVxuICB9XG5cbi8qKlxuICAgKiBSZXN0b3JlIHRoZSBJZGVudGl0eSBmb3IgdGhlIHNlc3Npb24gb3duZXIgZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc3RvcmVMYXN0U2Vzc2lvblxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5JZGVudGl0eX1cbiAgICovXG4gIF9yZXN0b3JlTGFzdFVzZXIoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gZ2xvYmFsLmxvY2FsU3RvcmFnZVtMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWRdO1xuICAgICAgaWYgKCFzZXNzaW9uRGF0YSkgcmV0dXJuIG51bGw7XG4gICAgICBjb25zdCB1c2VyT2JqID0gSlNPTi5wYXJzZShzZXNzaW9uRGF0YSkudXNlcjtcbiAgICAgIHJldHVybiBuZXcgSWRlbnRpdHkoe1xuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgc2Vzc2lvbk93bmVyOiB0cnVlLFxuICAgICAgICBmcm9tU2VydmVyOiB1c2VyT2JqLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYXMgdGhlIHVzZXJJRCBjaGFuZ2VkIHNpbmNlIHRoZSBsYXN0IGxvZ2luP1xuICAgKlxuICAgKiBAbWV0aG9kIF9oYXNVc2VySWRDaGFuZ2VkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWRcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFzVXNlcklkQ2hhbmdlZCh1c2VySWQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHNlc3Npb25EYXRhKS51c2VyLnVzZXJfaWQgIT09IHVzZXJJZDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYXRlcyB0aGUgY29ubmVjdGlvbi5cbiAgICpcbiAgICogQ2FsbGVkIGJ5IGNvbnN0cnVjdG9yKCkuXG4gICAqXG4gICAqIFdpbGwgZWl0aGVyIGF0dGVtcHQgdG8gdmFsaWRhdGUgdGhlIGNhY2hlZCBzZXNzaW9uVG9rZW4gYnkgZ2V0dGluZyBjb252ZXJhdGlvbnMsXG4gICAqIG9yIGlmIG5vIHNlc3Npb25Ub2tlbiwgd2lsbCBjYWxsIC9ub25jZXMgdG8gc3RhcnQgcHJvY2VzcyBvZiBnZXR0aW5nIGEgbmV3IG9uZS5cbiAgICpcbiAgICogYGBgamF2YXNjcmlwdFxuICAgKiB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7YXBwSWQ6IG15QXBwSWR9KTtcbiAgICogY2xpZW50LmNvbm5lY3QoJ0Zyb2RvLXRoZS1Eb2RvJyk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIFVzZXIgSUQgb2YgdGhlIHVzZXIgeW91IGFyZSBsb2dnaW5nIGluIGFzXG4gICAqIEByZXR1cm5zIHtsYXllci5DbGllbnRBdXRoZW50aWNhdG9yfSB0aGlzXG4gICAqL1xuICBjb25uZWN0KHVzZXJJZCA9ICcnKSB7XG4gICAgbGV0IHVzZXI7XG4gICAgdGhpcy5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLnN0YXJ0KCk7XG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSB8fCAhdXNlcklkIHx8IHRoaXMuX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZCgpIHx8IHRoaXMuX2hhc1VzZXJJZENoYW5nZWQodXNlcklkKSkge1xuICAgICAgdGhpcy5fY2xlYXJTdG9yZWREYXRhKCk7XG4gICAgfVxuXG5cbiAgICBpZiAodGhpcy5pc1RydXN0ZWREZXZpY2UgJiYgdXNlcklkKSB7XG4gICAgICB0aGlzLl9yZXN0b3JlTGFzdFNlc3Npb24odXNlcklkKTtcbiAgICAgIHVzZXIgPSB0aGlzLl9yZXN0b3JlTGFzdFVzZXIoKTtcbiAgICAgIGlmICh1c2VyKSB0aGlzLnVzZXIgPSB1c2VyO1xuICAgIH1cblxuICAgIGlmICghdGhpcy51c2VyKSB7XG4gICAgICB0aGlzLnVzZXIgPSBuZXcgSWRlbnRpdHkoe1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHNlc3Npb25Pd25lcjogdHJ1ZSxcbiAgICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgIGlkOiB1c2VySWQgPyBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KHVzZXJJZCkgOiAnJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbiAmJiB0aGlzLnVzZXIudXNlcklkKSB7XG4gICAgICB0aGlzLl9zZXNzaW9uVG9rZW5SZXN0b3JlZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnhocih7XG4gICAgICAgIHVybDogJy9ub25jZXMnLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICB9LCAocmVzdWx0KSA9PiB0aGlzLl9jb25uZWN0aW9uUmVzcG9uc2UocmVzdWx0KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYXRlcyB0aGUgY29ubmVjdGlvbiB3aXRoIGEgc2Vzc2lvbiB0b2tlbi5cbiAgICpcbiAgICogVGhpcyBjYWxsIGlzIGZvciB1c2Ugd2hlbiB5b3UgaGF2ZSByZWNlaXZlZCBhIFNlc3Npb24gVG9rZW4gZnJvbSBzb21lIG90aGVyIHNvdXJjZTsgc3VjaCBhcyB5b3VyIHNlcnZlcixcbiAgICogYW5kIHdpc2ggdG8gdXNlIHRoYXQgaW5zdGVhZCBvZiBkb2luZyBhIGZ1bGwgYXV0aCBwcm9jZXNzLlxuICAgKlxuICAgKiBUaGUgQ2xpZW50IHdpbGwgcHJlc3VtZSB0aGUgdG9rZW4gdG8gYmUgdmFsaWQsIGFuZCB3aWxsIGFzeW5jaHJvbm91c2x5IHRyaWdnZXIgdGhlIGByZWFkeWAgZXZlbnQuXG4gICAqIElmIHRoZSB0b2tlbiBwcm92aWRlZCBpcyBOT1QgdmFsaWQsIHRoaXMgd29uJ3QgYmUgZGV0ZWN0ZWQgdW50aWwgYSByZXF1ZXN0IGlzIG1hZGUgdXNpbmcgdGhpcyB0b2tlbixcbiAgICogYXQgd2hpY2ggcG9pbnQgdGhlIGBjaGFsbGVuZ2VgIG1ldGhvZCB3aWxsIHRyaWdnZXIuXG4gICAqXG4gICAqIE5PVEU6IFRoZSBgY29ubmVjdGVkYCBldmVudCB3aWxsIG5vdCBiZSB0cmlnZ2VyZWQgb24gdGhpcyBwYXRoLlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHthcHBJZDogbXlBcHBJZH0pO1xuICAgKiBjbGllbnQuY29ubmVjdFdpdGhTZXNzaW9uKCdGcm9kby10aGUtRG9kbycsIG15U2Vzc2lvblRva2VuKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgY29ubmVjdFdpdGhTZXNzaW9uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB1c2VySWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNlc3Npb25Ub2tlblxuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgY29ubmVjdFdpdGhTZXNzaW9uKHVzZXJJZCwgc2Vzc2lvblRva2VuKSB7XG4gICAgbGV0IHVzZXI7XG4gICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICBpZiAoIXVzZXJJZCB8fCAhc2Vzc2lvblRva2VuKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LnNlc3Npb25BbmRVc2VyUmVxdWlyZWQpO1xuICAgIGlmICghdGhpcy5pc1RydXN0ZWREZXZpY2UgfHwgdGhpcy5faXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkgfHwgdGhpcy5faGFzVXNlcklkQ2hhbmdlZCh1c2VySWQpKSB7XG4gICAgICB0aGlzLl9jbGVhclN0b3JlZERhdGEoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuaXNUcnVzdGVkRGV2aWNlKSB7XG4gICAgICB1c2VyID0gdGhpcy5fcmVzdG9yZUxhc3RVc2VyKCk7XG4gICAgICBpZiAodXNlcikgdGhpcy51c2VyID0gdXNlcjtcbiAgICB9XG5cbiAgICB0aGlzLm9ubGluZU1hbmFnZXIuc3RhcnQoKTtcblxuICAgIGlmICghdGhpcy51c2VyKSB7XG4gICAgICB0aGlzLnVzZXIgPSBuZXcgSWRlbnRpdHkoe1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHNlc3Npb25Pd25lcjogdHJ1ZSxcbiAgICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgIGlkOiBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KHVzZXJJZCksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gdHJ1ZTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX2F1dGhDb21wbGV0ZSh7IHNlc3Npb25fdG9rZW46IHNlc3Npb25Ub2tlbiB9LCBmYWxzZSksIDEpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIG91ciByZXF1ZXN0IGZvciBhIG5vbmNlIGdldHMgYSByZXNwb25zZS5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgYW4gZXJyb3IsIGNhbGxzIF9jb25uZWN0aW9uRXJyb3IuXG4gICAqXG4gICAqIElmIHRoZXJlIGlzIG5vbmNlLCBjYWxscyBfY29ubmVjdGlvbkNvbXBsZXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jb25uZWN0aW9uUmVzcG9uc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICovXG4gIF9jb25uZWN0aW9uUmVzcG9uc2UocmVzdWx0KSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5fY29ubmVjdGlvbkVycm9yKHJlc3VsdC5kYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY29ubmVjdGlvbkNvbXBsZXRlKHJlc3VsdC5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2UgYXJlIG5vdyBjb25uZWN0ZWQgKHdlIGhhdmUgYSBub25jZSkuXG4gICAqXG4gICAqIElmIHdlIGhhdmUgc3VjY2Vzc2Z1bGx5IHJldHJpZXZlZCBhIG5vbmNlLCB0aGVuXG4gICAqIHdlIGhhdmUgZW50ZXJlZCBhIFwiY29ubmVjdGVkXCIgYnV0IG5vdCBcImF1dGhlbnRpY2F0ZWRcIiBzdGF0ZS5cbiAgICogU2V0IHRoZSBzdGF0ZSwgdHJpZ2dlciBhbnkgZXZlbnRzLCBhbmQgdGhlbiBzdGFydCBhdXRoZW50aWNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkNvbXBsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSAge3N0cmluZ30gcmVzdWx0Lm5vbmNlIC0gVGhlIG5vbmNlIHByb3ZpZGVkIGJ5IHRoZSBzZXJ2ZXJcbiAgICpcbiAgICogQGZpcmVzIGNvbm5lY3RlZFxuICAgKi9cbiAgX2Nvbm5lY3Rpb25Db21wbGV0ZShyZXN1bHQpIHtcbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gdHJ1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2Nvbm5lY3RlZCcpO1xuICAgIHRoaXMuX2F1dGhlbnRpY2F0ZShyZXN1bHQubm9uY2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIHdlIGZhaWwgdG8gZ2V0IGEgbm9uY2UuXG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25FcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckVycm9yfSBlcnJcbiAgICpcbiAgICogQGZpcmVzIGNvbm5lY3RlZC1lcnJvclxuICAgKi9cbiAgX2Nvbm5lY3Rpb25FcnJvcihlcnJvcikge1xuICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkLWVycm9yJywgeyBlcnJvciB9KTtcbiAgfVxuXG5cbiAgLyogQ09OTkVDVCBNRVRIT0RTIEVORCAqL1xuXG4gIC8qIEFVVEhFTlRJQ0FURSBNRVRIT0RTIEJFR0lOICovXG5cbiAgLyoqXG4gICAqIFN0YXJ0IHRoZSBhdXRoZW50aWNhdGlvbiBzdGVwLlxuICAgKlxuICAgKiBXZSBzdGFydCBhdXRoZW50aWNhdGlvbiBieSB0cmlnZ2VyaW5nIGEgXCJjaGFsbGVuZ2VcIiBldmVudCB0aGF0XG4gICAqIHRlbGxzIHRoZSBhcHAgdG8gdXNlIHRoZSBub25jZSB0byBvYnRhaW4gYW4gaWRlbnRpdHlfdG9rZW4uXG4gICAqXG4gICAqIEBtZXRob2QgX2F1dGhlbnRpY2F0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5vbmNlIC0gVGhlIG5vbmNlIHRvIHByb3ZpZGUgeW91ciBpZGVudGl0eSBwcm92aWRlciBzZXJ2aWNlXG4gICAqXG4gICAqIEBmaXJlcyBjaGFsbGVuZ2VcbiAgICovXG4gIF9hdXRoZW50aWNhdGUobm9uY2UpIHtcbiAgICBpZiAobm9uY2UpIHtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbGxlbmdlJywge1xuICAgICAgICBub25jZSxcbiAgICAgICAgY2FsbGJhY2s6IHRoaXMuYW5zd2VyQXV0aGVudGljYXRpb25DaGFsbGVuZ2UuYmluZCh0aGlzKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBY2NlcHQgYW4gaWRlbnRpdHlUb2tlbiBhbmQgdXNlIGl0IHRvIGNyZWF0ZSBhIHNlc3Npb24uXG4gICAqXG4gICAqIFR5cGljYWxseSwgdGhpcyBtZXRob2QgaXMgY2FsbGVkIHVzaW5nIHRoZSBmdW5jdGlvbiBwb2ludGVyIHByb3ZpZGVkIGJ5XG4gICAqIHRoZSBjaGFsbGVuZ2UgZXZlbnQsIGJ1dCBpdCBjYW4gYWxzbyBiZSBjYWxsZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICAgZ2V0SWRlbnRpdHlUb2tlbihub25jZSwgZnVuY3Rpb24oaWRlbnRpdHlUb2tlbikge1xuICAgKiAgICAgICAgICBjbGllbnQuYW5zd2VyQXV0aGVudGljYXRpb25DaGFsbGVuZ2UoaWRlbnRpdHlUb2tlbik7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgYW5zd2VyQXV0aGVudGljYXRpb25DaGFsbGVuZ2VcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZGVudGl0eVRva2VuIC0gSWRlbnRpdHkgdG9rZW4gcHJvdmlkZWQgYnkgeW91ciBpZGVudGl0eSBwcm92aWRlciBzZXJ2aWNlXG4gICAqL1xuICBhbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZShpZGVudGl0eVRva2VuKSB7XG4gICAgLy8gUmVwb3J0IGFuIGVycm9yIGlmIG5vIGlkZW50aXR5VG9rZW4gcHJvdmlkZWRcbiAgICBpZiAoIWlkZW50aXR5VG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaWRlbnRpdHlUb2tlbk1pc3NpbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB1c2VyRGF0YSA9IFV0aWwuZGVjb2RlKGlkZW50aXR5VG9rZW4uc3BsaXQoJy4nKVsxXSk7XG4gICAgICBjb25zdCBpZGVudGl0eU9iaiA9IEpTT04ucGFyc2UodXNlckRhdGEpO1xuXG4gICAgICBpZiAodGhpcy51c2VyLnVzZXJJZCAmJiB0aGlzLnVzZXIudXNlcklkICE9PSBpZGVudGl0eU9iai5wcm4pIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaW52YWxpZFVzZXJJZENoYW5nZSk7XG5cbiAgICAgIHRoaXMudXNlci5fc2V0VXNlcklkKGlkZW50aXR5T2JqLnBybik7XG5cbiAgICAgIGlmIChpZGVudGl0eU9iai5kaXNwbGF5X25hbWUpIHRoaXMudXNlci5kaXNwbGF5TmFtZSA9IGlkZW50aXR5T2JqLmRpc3BsYXlfbmFtZTtcbiAgICAgIGlmIChpZGVudGl0eU9iai5hdmF0YXJfdXJsKSB0aGlzLnVzZXIuYXZhdGFyVXJsID0gaWRlbnRpdHlPYmouYXZhdGFyX3VybDtcblxuICAgICAgdGhpcy54aHIoe1xuICAgICAgICB1cmw6ICcvc2Vzc2lvbnMnLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpZGVudGl0eV90b2tlbjogaWRlbnRpdHlUb2tlbixcbiAgICAgICAgICBhcHBfaWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgIH0sXG4gICAgICB9LCAocmVzdWx0KSA9PiB0aGlzLl9hdXRoUmVzcG9uc2UocmVzdWx0LCBpZGVudGl0eVRva2VuKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIG91ciByZXF1ZXN0IGZvciBhIHNlc3Npb25Ub2tlbiByZWNlaXZlcyBhIHJlc3BvbnNlLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbWV0aG9kIF9hdXRoUmVzcG9uc2VcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZGVudGl0eVRva2VuXG4gICAqL1xuICBfYXV0aFJlc3BvbnNlKHJlc3VsdCwgaWRlbnRpdHlUb2tlbikge1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX2F1dGhFcnJvcihyZXN1bHQuZGF0YSwgaWRlbnRpdHlUb2tlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F1dGhDb21wbGV0ZShyZXN1bHQuZGF0YSwgZmFsc2UpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIEF1dGhlbnRpY2F0aW9uIGlzIGNvbXBsZXRlZCwgdXBkYXRlIHN0YXRlIGFuZCB0cmlnZ2VyIGV2ZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBfYXV0aENvbXBsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IGZyb21QZXJzaXN0ZW5jZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHJlc3VsdC5zZXNzaW9uX3Rva2VuIC0gU2Vzc2lvbiB0b2tlbiByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICpcbiAgICogQGZpcmVzIGF1dGhlbnRpY2F0ZWRcbiAgICovXG4gIF9hdXRoQ29tcGxldGUocmVzdWx0LCBmcm9tUGVyc2lzdGVuY2UpIHtcbiAgICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0LnNlc3Npb25fdG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuc2Vzc2lvblRva2VuTWlzc2luZyk7XG4gICAgfVxuICAgIHRoaXMuc2Vzc2lvblRva2VuID0gcmVzdWx0LnNlc3Npb25fdG9rZW47XG5cbiAgICAvLyBJZiBfYXV0aENvbXBsZXRlIHdhcyBjYWxsZWQgYmVjYXVzZSB3ZSBhY2NlcHRlZCBhbiBhdXRoIGxvYWRlZCBmcm9tIHN0b3JhZ2VcbiAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIHVwZGF0ZSBzdG9yYWdlLlxuICAgIGlmICghdGhpcy5faXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkgJiYgIWZyb21QZXJzaXN0ZW5jZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZ2xvYmFsLmxvY2FsU3RvcmFnZVtMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWRdID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHNlc3Npb25Ub2tlbjogdGhpcy5zZXNzaW9uVG9rZW4gfHwgJycsXG4gICAgICAgICAgdXNlcjogRGJNYW5hZ2VyLnByb3RvdHlwZS5fZ2V0SWRlbnRpdHlEYXRhKFt0aGlzLnVzZXJdLCB0cnVlKVswXSxcbiAgICAgICAgICBleHBpcmVzOiBEYXRlLm5vdygpICsgMzAgKiA2MCAqIDYwICogMjQgKiAxMDAwLFxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZ1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2NsaWVudEF1dGhlbnRpY2F0ZWQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdXRoZW50aWNhdGlvbiBoYXMgZmFpbGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9hdXRoRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFcnJvcn0gcmVzdWx0XG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRlbnRpdHlUb2tlbiBOb3QgY3VycmVudGx5IHVzZWRcbiAgICpcbiAgICogQGZpcmVzIGF1dGhlbnRpY2F0ZWQtZXJyb3JcbiAgICovXG4gIF9hdXRoRXJyb3IoZXJyb3IsIGlkZW50aXR5VG9rZW4pIHtcbiAgICB0aGlzLnRyaWdnZXIoJ2F1dGhlbnRpY2F0ZWQtZXJyb3InLCB7IGVycm9yIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgc3RhdGUgYW5kIHRyaWdnZXJzIGV2ZW50cyBmb3IgYm90aCBjb25uZWN0ZWQgYW5kIGF1dGhlbnRpY2F0ZWQuXG4gICAqXG4gICAqIElmIHJldXNpbmcgYSBzZXNzaW9uVG9rZW4gY2FjaGVkIGluIGxvY2FsU3RvcmFnZSxcbiAgICogdXNlIHRoaXMgbWV0aG9kIHJhdGhlciB0aGFuIF9hdXRoQ29tcGxldGUuXG4gICAqXG4gICAqIEBtZXRob2QgX3Nlc3Npb25Ub2tlblJlc3RvcmVkXG4gICAqIEBwcml2YXRlXG4gICAqXG4gICAqIEBmaXJlcyBjb25uZWN0ZWQsIGF1dGhlbnRpY2F0ZWRcbiAgICovXG4gIF9zZXNzaW9uVG9rZW5SZXN0b3JlZCgpIHtcbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gdHJ1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2Nvbm5lY3RlZCcpO1xuICAgIHRoaXMuX2NsaWVudEF1dGhlbnRpY2F0ZWQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgY2xpZW50IGlzIG5vdyBhdXRoZW50aWNhdGVkLCBhbmQgZG9pbmcgc29tZSBzZXR1cFxuICAgKiBiZWZvcmUgY2FsbGluZyBfY2xpZW50UmVhZHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2NsaWVudEF1dGhlbnRpY2F0ZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jbGllbnRBdXRoZW50aWNhdGVkKCkge1xuICAgIC8vIFVwZGF0ZSBzdGF0ZSBhbmQgdHJpZ2dlciB0aGUgZXZlbnRcbiAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IHRydWU7XG4gICAgdGhpcy50cmlnZ2VyKCdhdXRoZW50aWNhdGVkJyk7XG5cbiAgICBpZiAoIXRoaXMuaXNUcnVzdGVkRGV2aWNlKSB0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkID0gZmFsc2U7XG5cblxuICAgIC8vIElmIG5vIHBlcnNpc3RlbmNlRmVhdHVyZXMgYXJlIHNwZWNpZmllZCwgc2V0IHRoZW0gYWxsXG4gICAgLy8gdG8gdHJ1ZSBvciBmYWxzZSB0byBtYXRjaCBpc1RydXN0ZWREZXZpY2UuXG4gICAgaWYgKCF0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMgfHwgIXRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQpIHtcbiAgICAgIGxldCBzZXNzaW9uVG9rZW47XG4gICAgICBpZiAodGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzICYmICdzZXNzaW9uVG9rZW4nIGluIHRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcykge1xuICAgICAgICBzZXNzaW9uVG9rZW4gPSBCb29sZWFuKHRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcy5zZXNzaW9uVG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2Vzc2lvblRva2VuID0gdGhpcy5pc1RydXN0ZWREZXZpY2U7XG4gICAgICB9XG4gICAgICB0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMgPSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbnM6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIG1lc3NhZ2VzOiB0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkLFxuICAgICAgICBzeW5jUXVldWU6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIHNlc3Npb25Ub2tlbixcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gU2V0dXAgdGhlIERhdGFiYXNlIE1hbmFnZXJcbiAgICBpZiAoIXRoaXMuZGJNYW5hZ2VyKSB7XG4gICAgICB0aGlzLmRiTWFuYWdlciA9IG5ldyBEYk1hbmFnZXIoe1xuICAgICAgICBjbGllbnQ6IHRoaXMsXG4gICAgICAgIHRhYmxlczogdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQmVmb3JlIGNhbGxpbmcgX2NsaWVudFJlYWR5LCBsb2FkIHRoZSBzZXNzaW9uIG93bmVyJ3MgZnVsbCBJZGVudGl0eS5cbiAgICBpZiAodGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCkge1xuICAgICAgdGhpcy5kYk1hbmFnZXIub25PcGVuKCgpID0+IHRoaXMuX2xvYWRVc2VyKCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9sb2FkVXNlcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIHRoZSBzZXNzaW9uIG93bmVyJ3MgZnVsbCBpZGVudGl0eS5cbiAgICpcbiAgICogTm90ZSB0aGF0IGZhaWx1cmUgdG8gbG9hZCB0aGUgaWRlbnRpdHkgd2lsbCBub3QgcHJldmVudFxuICAgKiBfY2xpZW50UmVhZHksIGJ1dCBpcyBjZXJ0YWlubHkgbm90IGEgZGVzaXJlZCBvdXRjb21lLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkVXNlclxuICAgKi9cbiAgX2xvYWRVc2VyKCkge1xuICAgIC8vIFdlJ3JlIGRvbmUgaWYgd2UgZ290IHRoZSBmdWxsIGlkZW50aXR5IGZyb20gbG9jYWxTdG9yYWdlLlxuICAgIGlmICh0aGlzLnVzZXIuaXNGdWxsSWRlbnRpdHkpIHtcbiAgICAgIHRoaXMuX2NsaWVudFJlYWR5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGxvYWQgdGhlIHVzZXIncyBmdWxsIElkZW50aXR5IGFuZCB1cGRhdGUgbG9jYWxTdG9yYWdlXG4gICAgICB0aGlzLnVzZXIuX2xvYWQoKTtcbiAgICAgIHRoaXMudXNlci5vbmNlKCdpZGVudGl0aWVzOmxvYWRlZCcsICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHNlc3Npb24gZGF0YSBpbiBsb2NhbFN0b3JhZ2Ugd2l0aCBvdXIgZnVsbCBJZGVudGl0eS5cbiAgICAgICAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gSlNPTi5wYXJzZShnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0pO1xuICAgICAgICAgICAgc2Vzc2lvbkRhdGEudXNlciA9IERiTWFuYWdlci5wcm90b3R5cGUuX2dldElkZW50aXR5RGF0YShbdGhpcy51c2VyXSlbMF07XG4gICAgICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0gPSBKU09OLnN0cmluZ2lmeShzZXNzaW9uRGF0YSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gbm8tb3BcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2xpZW50UmVhZHkoKTtcbiAgICAgIH0pXG4gICAgICAub25jZSgnaWRlbnRpdGllczpsb2FkZWQtZXJyb3InLCAoKSA9PiB7XG4gICAgICAgIGlmICghdGhpcy51c2VyLmRpc3BsYXlOYW1lKSB0aGlzLnVzZXIuZGlzcGxheU5hbWUgPSB0aGlzLmRlZmF1bHRPd25lckRpc3BsYXlOYW1lO1xuICAgICAgICB0aGlzLl9jbGllbnRSZWFkeSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB0byBmbGFnIHRoZSBjbGllbnQgYXMgcmVhZHkgZm9yIGFjdGlvbi5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaXMgY2FsbGVkIGFmdGVyIGF1dGhlbmljYXRpb24gQU5EXG4gICAqIGFmdGVyIGluaXRpYWwgY29udmVyc2F0aW9ucyBoYXZlIGJlZW4gbG9hZGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGllbnRSZWFkeVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAZmlyZXMgcmVhZHlcbiAgICovXG4gIF9jbGllbnRSZWFkeSgpIHtcbiAgICBpZiAoIXRoaXMuaXNSZWFkeSkge1xuICAgICAgdGhpcy5pc1JlYWR5ID0gdHJ1ZTtcbiAgICAgIHRoaXMudHJpZ2dlcigncmVhZHknKTtcbiAgICB9XG4gIH1cblxuXG4gIC8qIENPTk5FQ1QgTUVUSE9EUyBFTkQgKi9cblxuXG4gIC8qIFNUQVJUIFNFU1NJT04gTUFOQUdFTUVOVCBNRVRIT0RTICovXG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgeW91ciBzZXNzaW9uVG9rZW4gZnJvbSB0aGUgc2VydmVyLCBhbmQgcmVtb3ZlcyBhbGwgdXNlciBkYXRhIGZyb20gdGhlIENsaWVudC5cbiAgICogQ2FsbCBgY2xpZW50LmNvbm5lY3QoKWAgdG8gcmVzdGFydCB0aGUgYXV0aGVudGljYXRpb24gcHJvY2Vzcy5cbiAgICpcbiAgICogVGhpcyBjYWxsIGlzIGFzeW5jaHJvbm91czsgc29tZSBicm93c2VycyAoYWhlbSwgc2FmYXJpLi4uKSBtYXkgbm90IGhhdmUgY29tcGxldGVkIHRoZSBkZWxldGlvbiBvZlxuICAgKiBwZXJzaXN0ZWQgZGF0YSBpZiB5b3VcbiAgICogbmF2aWdhdGUgYXdheSBmcm9tIHRoZSBwYWdlLiAgVXNlIHRoZSBjYWxsYmFjayB0byBkZXRlcm1pbmUgd2hlbiBhbGwgbmVjZXNzYXJ5IGNsZWFudXAgaGFzIGNvbXBsZXRlZFxuICAgKiBwcmlvciB0byBuYXZpZ2F0aW5nIGF3YXkuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB3aGlsZSBhbGwgZGF0YSBzaG91bGQgYmUgcHVyZ2VkIGZyb20gdGhlIGJyb3dzZXIvZGV2aWNlLCBpZiB5b3UgYXJlIG9mZmxpbmUgd2hlbiB0aGlzIGlzIGNhbGxlZCxcbiAgICogeW91ciBzZXNzaW9uIHRva2VuIHdpbGwgTk9UIGJlIGRlbGV0ZWQgZnJvbSB0aGUgd2ViIHNlcnZlci4gIFdoeSBub3Q/IEJlY2F1c2UgaXQgd291bGQgaW52b2x2ZSByZXRhaW5pbmcgdGhlXG4gICAqIHJlcXVlc3QgYWZ0ZXIgYWxsIG9mIHRoZSB1c2VyJ3MgZGF0YSBoYXMgYmVlbiBkZWxldGVkLCBvciBOT1QgZGVsZXRpbmcgdGhlIHVzZXIncyBkYXRhIHVudGlsIHdlIGFyZSBvbmxpbmUuXG4gICAqXG4gICAqIEBtZXRob2QgbG9nb3V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm4ge2xheWVyLkNsaWVudEF1dGhlbnRpY2F0b3J9IHRoaXNcbiAgICovXG4gIGxvZ291dChjYWxsYmFjaykge1xuICAgIGxldCBjYWxsYmFja0NvdW50ID0gMSxcbiAgICAgICBjb3VudGVyID0gMDtcbiAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQpIHtcbiAgICAgIGNhbGxiYWNrQ291bnQrKztcbiAgICAgIHRoaXMueGhyKHtcbiAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgICAgdXJsOiAnL3Nlc3Npb25zLycgKyBlc2NhcGUodGhpcy5zZXNzaW9uVG9rZW4pLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sICgpID0+IHtcbiAgICAgICAgY291bnRlcisrO1xuICAgICAgICBpZiAoY291bnRlciA9PT0gY2FsbGJhY2tDb3VudCAmJiBjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENsZWFyIGRhdGEgZXZlbiBpZiBpc0F1dGhlbnRpY2F0ZWQgaXMgZmFsc2VcbiAgICAvLyBTZXNzaW9uIG1heSBoYXZlIGV4cGlyZWQsIGJ1dCBkYXRhIHN0aWxsIGNhY2hlZC5cbiAgICB0aGlzLl9jbGVhclN0b3JlZERhdGEoKCkgPT4ge1xuICAgICAgY291bnRlcisrO1xuICAgICAgaWYgKGNvdW50ZXIgPT09IGNhbGxiYWNrQ291bnQgJiYgY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl9yZXNldFNlc3Npb24oKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG5cbiAgX2NsZWFyU3RvcmVkRGF0YShjYWxsYmFjaykge1xuICAgIGlmIChnbG9iYWwubG9jYWxTdG9yYWdlKSBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWQpO1xuICAgIGlmICh0aGlzLmRiTWFuYWdlcikge1xuICAgICAgdGhpcy5kYk1hbmFnZXIuZGVsZXRlVGFibGVzKGNhbGxiYWNrKTtcbiAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2cgb3V0L2NsZWFyIHNlc3Npb24gaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIFVzZSB0aGlzIHRvIGNsZWFyIHRoZSBzZXNzaW9uVG9rZW4gYW5kIGFsbCBpbmZvcm1hdGlvbiBmcm9tIHRoaXMgc2Vzc2lvbi5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVzZXRTZXNzaW9uKCkge1xuICAgIHRoaXMuaXNSZWFkeSA9IGZhbHNlO1xuICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbikge1xuICAgICAgdGhpcy5zZXNzaW9uVG9rZW4gPSAnJztcbiAgICAgIGlmIChnbG9iYWwubG9jYWxTdG9yYWdlKSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKExPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZmFsc2U7XG5cbiAgICB0aGlzLnRyaWdnZXIoJ2RlYXV0aGVudGljYXRlZCcpO1xuICAgIHRoaXMub25saW5lTWFuYWdlci5zdG9wKCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB5b3VyIElPUyBkZXZpY2UgdG8gcmVjZWl2ZSBub3RpZmljYXRpb25zLlxuICAgKiBGb3IgdXNlIHdpdGggbmF0aXZlIGNvZGUgb25seSAoQ29yZG92YSwgUmVhY3QgTmF0aXZlLCBUaXRhbml1bSwgZXRjLi4uKVxuICAgKlxuICAgKiBAbWV0aG9kIHJlZ2lzdGVySU9TUHVzaFRva2VuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLmRldmljZUlkIC0gWW91ciBJT1MgZGV2aWNlJ3MgZGV2aWNlIElEXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLmlvc1ZlcnNpb24gLSBZb3VyIElPUyBkZXZpY2UncyB2ZXJzaW9uIG51bWJlclxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy50b2tlbiAtIFlvdXIgQXBwbGUgQVBOUyBUb2tlblxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuYnVuZGxlSWRdIC0gWW91ciBBcHBsZSBBUE5TIEJ1bmRsZSBJRCAoXCJjb20ubGF5ZXIuYnVuZGxlaWRcIilcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPW51bGxdIC0gT3B0aW9uYWwgY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBjYWxsYmFjay5lcnJvciAtIExheWVyRXJyb3IgaWYgdGhlcmUgd2FzIGFuIGVycm9yOyBudWxsIGlmIHN1Y2Nlc3NmdWxcbiAgICovXG4gIHJlZ2lzdGVySU9TUHVzaFRva2VuKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy54aHIoe1xuICAgICAgdXJsOiAncHVzaF90b2tlbnMnLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdG9rZW46IG9wdGlvbnMudG9rZW4sXG4gICAgICAgIHR5cGU6ICdhcG5zJyxcbiAgICAgICAgZGV2aWNlX2lkOiBvcHRpb25zLmRldmljZUlkLFxuICAgICAgICBpb3NfdmVyc2lvbjogb3B0aW9ucy5pb3NWZXJzaW9uLFxuICAgICAgICBhcG5zX2J1bmRsZV9pZDogb3B0aW9ucy5idW5kbGVJZCxcbiAgICAgIH0sXG4gICAgfSwgKHJlc3VsdCkgPT4gY2FsbGJhY2socmVzdWx0LmRhdGEpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB5b3VyIEFuZHJvaWQgZGV2aWNlIHRvIHJlY2VpdmUgbm90aWZpY2F0aW9ucy5cbiAgICogRm9yIHVzZSB3aXRoIG5hdGl2ZSBjb2RlIG9ubHkgKENvcmRvdmEsIFJlYWN0IE5hdGl2ZSwgVGl0YW5pdW0sIGV0Yy4uLilcbiAgICpcbiAgICogQG1ldGhvZCByZWdpc3RlckFuZHJvaWRQdXNoVG9rZW5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMuZGV2aWNlSWQgLSBZb3VyIElPUyBkZXZpY2UncyBkZXZpY2UgSURcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMudG9rZW4gLSBZb3VyIEdDTSBwdXNoIFRva2VuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLnNlbmRlcklkIC0gWW91ciBHQ00gU2VuZGVyIElEL1Byb2plY3QgTnVtYmVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1udWxsXSAtIE9wdGlvbmFsIGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gY2FsbGJhY2suZXJyb3IgLSBMYXllckVycm9yIGlmIHRoZXJlIHdhcyBhbiBlcnJvcjsgbnVsbCBpZiBzdWNjZXNzZnVsXG4gICAqL1xuICByZWdpc3RlckFuZHJvaWRQdXNoVG9rZW4ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB0aGlzLnhocih7XG4gICAgICB1cmw6ICdwdXNoX3Rva2VucycsXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgZGF0YToge1xuICAgICAgICB0b2tlbjogb3B0aW9ucy50b2tlbixcbiAgICAgICAgdHlwZTogJ2djbScsXG4gICAgICAgIGRldmljZV9pZDogb3B0aW9ucy5kZXZpY2VJZCxcbiAgICAgICAgZ2NtX3NlbmRlcl9pZDogb3B0aW9ucy5zZW5kZXJJZCxcbiAgICAgIH0sXG4gICAgfSwgKHJlc3VsdCkgPT4gY2FsbGJhY2socmVzdWx0LmRhdGEpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB5b3VyIEFuZHJvaWQgZGV2aWNlIHRvIHJlY2VpdmUgbm90aWZpY2F0aW9ucy5cbiAgICogRm9yIHVzZSB3aXRoIG5hdGl2ZSBjb2RlIG9ubHkgKENvcmRvdmEsIFJlYWN0IE5hdGl2ZSwgVGl0YW5pdW0sIGV0Yy4uLilcbiAgICpcbiAgICogQG1ldGhvZCB1bnJlZ2lzdGVyUHVzaFRva2VuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkZXZpY2VJZCAtIFlvdXIgSU9TIGRldmljZSdzIGRldmljZSBJRFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9bnVsbF0gLSBPcHRpb25hbCBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGNhbGxiYWNrLmVycm9yIC0gTGF5ZXJFcnJvciBpZiB0aGVyZSB3YXMgYW4gZXJyb3I7IG51bGwgaWYgc3VjY2Vzc2Z1bFxuICAgKi9cbiAgdW5yZWdpc3RlclB1c2hUb2tlbihkZXZpY2VJZCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnhocih7XG4gICAgICB1cmw6ICdwdXNoX3Rva2Vucy8nICsgZGV2aWNlSWQsXG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgIH0sIChyZXN1bHQpID0+IGNhbGxiYWNrKHJlc3VsdC5kYXRhKSk7XG4gIH1cblxuICAvKiBTRVNTSU9OIE1BTkFHRU1FTlQgTUVUSE9EUyBFTkQgKi9cblxuXG4gIC8qIEFDQ0VTU09SIE1FVEhPRFMgQkVHSU4gKi9cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGF0dGVtcHQgdG8gZXhlY3V0ZSBgdGhpcy51c2VyQXBwSWQgPSAneHh4J2Agd2lsbCBjYXVzZSBhbiBlcnJvciB0byBiZSB0aHJvd25cbiAgICogaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfX2FkanVzdEFwcElkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIE5ldyBhcHBJZCB2YWx1ZVxuICAgKi9cbiAgX19hZGp1c3RBcHBJZCgpIHtcbiAgICBpZiAodGhpcy5pc0Nvbm5lY3RlZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jYW50Q2hhbmdlSWZDb25uZWN0ZWQpO1xuICB9XG5cbiAvKipcbiAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAqXG4gICogQW55IGF0dGVtcHQgdG8gZXhlY3V0ZSBgdGhpcy51c2VyID0gdXNlcklkZW50aXR5YCB3aWxsIGNhdXNlIGFuIGVycm9yIHRvIGJlIHRocm93blxuICAqIGlmIHRoZSBjbGllbnQgaXMgYWxyZWFkeSBjb25uZWN0ZWQuXG4gICpcbiAgKiBAcHJpdmF0ZVxuICAqIEBtZXRob2QgX19hZGp1c3RVc2VyXG4gICogQHBhcmFtIHtzdHJpbmd9IHVzZXIgLSBuZXcgSWRlbnRpdHkgb2JqZWN0XG4gICovXG4gIF9fYWRqdXN0VXNlcih1c2VyKSB7XG4gICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2FudENoYW5nZUlmQ29ubmVjdGVkKTtcbiAgICB9XG4gIH1cblxuICAvLyBWaXJ0dWFsIG1ldGhvZHNcbiAgX2FkZElkZW50aXR5KGlkZW50aXR5KSB7fVxuICBfcmVtb3ZlSWRlbnRpdHkoaWRlbnRpdHkpIHt9XG5cblxuICAvKiBBQ0NFU1NPUiBNRVRIT0RTIEVORCAqL1xuXG5cbiAgLyogQ09NTVVOSUNBVElPTlMgTUVUSE9EUyBCRUdJTiAqL1xuICBzZW5kU29ja2V0UmVxdWVzdChwYXJhbXMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHBhcmFtcy5zeW5jKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBwYXJhbXMuc3luYy50YXJnZXQ7XG4gICAgICBsZXQgZGVwZW5kcyA9IHBhcmFtcy5zeW5jLmRlcGVuZHM7XG4gICAgICBpZiAodGFyZ2V0ICYmICFkZXBlbmRzKSBkZXBlbmRzID0gW3RhcmdldF07XG5cbiAgICAgIHRoaXMuc3luY01hbmFnZXIucmVxdWVzdChuZXcgV2Vic29ja2V0U3luY0V2ZW50KHtcbiAgICAgICAgZGF0YTogcGFyYW1zLmJvZHksXG4gICAgICAgIG9wZXJhdGlvbjogcGFyYW1zLm1ldGhvZCxcbiAgICAgICAgdGFyZ2V0LFxuICAgICAgICBkZXBlbmRzLFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgIH0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBwYXJhbXMuZGF0YSA9PT0gJ2Z1bmN0aW9uJykgcGFyYW1zLmRhdGEgPSBwYXJhbXMuZGF0YSgpO1xuICAgICAgdGhpcy5zb2NrZXRSZXF1ZXN0TWFuYWdlci5zZW5kUmVxdWVzdChwYXJhbXMsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBldmVudCBoYW5kbGVyIHJlY2VpdmVzIGV2ZW50cyBmcm9tIHRoZSBPbmxpbmUgU3RhdGUgTWFuYWdlciBhbmQgZ2VuZXJhdGVzIGFuIGV2ZW50IGZvciB0aG9zZSBzdWJzY3JpYmVkXG4gICAqIHRvIGNsaWVudC5vbignb25saW5lJylcbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlT25saW5lQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlT25saW5lQ2hhbmdlKGV2dCkge1xuICAgIGlmICghdGhpcy5pc0F1dGhlbnRpY2F0ZWQpIHJldHVybjtcbiAgICBjb25zdCBkdXJhdGlvbiA9IGV2dC5vZmZsaW5lRHVyYXRpb247XG4gICAgY29uc3QgaXNPbmxpbmUgPSBldnQuZXZlbnROYW1lID09PSAnY29ubmVjdGVkJztcbiAgICBjb25zdCBvYmogPSB7IGlzT25saW5lIH07XG4gICAgaWYgKGlzT25saW5lKSB7XG4gICAgICBvYmoucmVzZXQgPSBkdXJhdGlvbiA+IENsaWVudEF1dGhlbnRpY2F0b3IuUmVzZXRBZnRlck9mZmxpbmVEdXJhdGlvbjtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdvbmxpbmUnLCBvYmopO1xuICB9XG5cbiAgLyoqXG4gICAqIE1haW4gZW50cnkgcG9pbnQgZm9yIHNlbmRpbmcgeGhyIHJlcXVlc3RzIG9yIGZvciBxdWVpbmcgdGhlbSBpbiB0aGUgc3luY01hbmFnZXIuXG4gICAqXG4gICAqIFRoaXMgY2FsbCBhZGp1c3QgYXJndW1lbnRzIGZvciBvdXIgUkVTVCBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgeGhyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdGlvbnNcbiAgICogQHBhcmFtICB7c3RyaW5nfSAgIG9wdGlvbnMudXJsIC0gVVJMIHJlbGF0aXZlIGNsaWVudCdzIHVybDogXCIvY29udmVyc2F0aW9uc1wiXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgY2FsbGJhY2sucmVzdWx0XG4gICAqIEBwYXJhbSAge01peGVkfSAgICBjYWxsYmFjay5yZXN1bHQuZGF0YSAtIElmIGFuIGVycm9yIG9jY3VycmVkLCB0aGlzIGlzIGEgbGF5ZXIuTGF5ZXJFcnJvcjtcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZiB0aGUgcmVzcG9uc2Ugd2FzIGFwcGxpY2F0aW9uL2pzb24sIHRoaXMgd2lsbCBiZSBhbiBvYmplY3RcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZiB0aGUgcmVzcG9uc2Ugd2FzIHRleHQvZW1wdHksIHRoaXMgd2lsbCBiZSB0ZXh0L2VtcHR5XG4gICAqIEBwYXJhbSAge1hNTEh0dHBSZXF1ZXN0fSBjYWxsYmFjay5yZXN1bHQueGhyIC0gTmF0aXZlIHhociByZXF1ZXN0IG9iamVjdCBmb3IgZGV0YWlsZWQgYW5hbHlzaXNcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIGNhbGxiYWNrLnJlc3VsdC5MaW5rcyAtIEhhc2ggb2YgTGluayBoZWFkZXJzXG4gICAqIEByZXR1cm4ge2xheWVyLkNsaWVudEF1dGhlbnRpY2F0b3J9IHRoaXNcbiAgICovXG4gIHhocihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghb3B0aW9ucy5zeW5jIHx8ICFvcHRpb25zLnN5bmMudGFyZ2V0KSB7XG4gICAgICBvcHRpb25zLnVybCA9IHRoaXMuX3hockZpeFJlbGF0aXZlVXJscyhvcHRpb25zLnVybCB8fCAnJyk7XG4gICAgfVxuXG4gICAgb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgIGlmICghb3B0aW9ucy5tZXRob2QpIG9wdGlvbnMubWV0aG9kID0gJ0dFVCc7XG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMpIG9wdGlvbnMuaGVhZGVycyA9IHt9O1xuICAgIHRoaXMuX3hockZpeEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKTtcbiAgICB0aGlzLl94aHJGaXhBdXRoKG9wdGlvbnMuaGVhZGVycyk7XG5cblxuICAgIC8vIE5vdGU6IHRoaXMgaXMgbm90IHN5bmMgdnMgYXN5bmM7IHRoaXMgaXMgc3luY01hbmFnZXIgdnMgZmlyZSBpdCBub3dcbiAgICBpZiAob3B0aW9ucy5zeW5jID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5fbm9uc3luY1hocihvcHRpb25zLCBjYWxsYmFjaywgMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N5bmNYaHIob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgeGhyIGNhbGxzIHRoYXQgZ28gdGhyb3VnaCB0aGUgc3luYyBtYW5hZ2VyLCBxdWV1ZSBpdCB1cC5cbiAgICpcbiAgICogQG1ldGhvZCBfc3luY1hoclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG4gIF9zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFvcHRpb25zLnN5bmMpIG9wdGlvbnMuc3luYyA9IHt9O1xuICAgIGNvbnN0IGlubmVyQ2FsbGJhY2sgPSAocmVzdWx0KSA9PiB7XG4gICAgICB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCBjYWxsYmFjayk7XG4gICAgfTtcbiAgICBjb25zdCB0YXJnZXQgPSBvcHRpb25zLnN5bmMudGFyZ2V0O1xuICAgIGxldCBkZXBlbmRzID0gb3B0aW9ucy5zeW5jLmRlcGVuZHM7XG4gICAgaWYgKHRhcmdldCAmJiAhZGVwZW5kcykgZGVwZW5kcyA9IFt0YXJnZXRdO1xuXG4gICAgdGhpcy5zeW5jTWFuYWdlci5yZXF1ZXN0KG5ldyBYSFJTeW5jRXZlbnQoe1xuICAgICAgdXJsOiBvcHRpb25zLnVybCxcbiAgICAgIGRhdGE6IG9wdGlvbnMuZGF0YSxcbiAgICAgIG1ldGhvZDogb3B0aW9ucy5tZXRob2QsXG4gICAgICBvcGVyYXRpb246IG9wdGlvbnMuc3luYy5vcGVyYXRpb24gfHwgb3B0aW9ucy5tZXRob2QsXG4gICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICBjYWxsYmFjazogaW5uZXJDYWxsYmFjayxcbiAgICAgIHRhcmdldCxcbiAgICAgIGRlcGVuZHMsXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciB4aHIgY2FsbHMgdGhhdCBkb24ndCBnbyB0aHJvdWdoIHRoZSBzeW5jIG1hbmFnZXIsXG4gICAqIGZpcmUgdGhlIHJlcXVlc3QsIGFuZCBpZiBpdCBmYWlscywgcmVmaXJlIGl0IHVwIHRvIDMgdHJpZXNcbiAgICogYmVmb3JlIHJlcG9ydGluZyBhbiBlcnJvci4gIDEgc2Vjb25kIGRlbGF5IGJldHdlZW4gcmVxdWVzdHNcbiAgICogc28gd2hhdGV2ZXIgaXNzdWUgaXMgb2NjdXJpbmcgaXMgYSB0aW55IGJpdCBtb3JlIGxpa2VseSB0byByZXNvbHZlLFxuICAgKiBhbmQgc28gd2UgZG9uJ3QgaGFtbWVyIHRoZSBzZXJ2ZXIgZXZlcnkgdGltZSB0aGVyZSdzIGEgcHJvYmxlbS5cbiAgICpcbiAgICogQG1ldGhvZCBfbm9uc3luY1hoclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHJldHJ5Q291bnRcbiAgICovXG4gIF9ub25zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrLCByZXRyeUNvdW50KSB7XG4gICAgeGhyKG9wdGlvbnMsIHJlc3VsdCA9PiB7XG4gICAgICBpZiAoWzUwMiwgNTAzLCA1MDRdLmluZGV4T2YocmVzdWx0LnN0YXR1cykgIT09IC0xICYmIHJldHJ5Q291bnQgPCBNQVhfWEhSX1JFVFJJRVMpIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9ub25zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrLCByZXRyeUNvdW50ICsgMSksIDEwMDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5feGhyUmVzdWx0KHJlc3VsdCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeCBhdXRoZW50aWNhdGlvbiBoZWFkZXIgZm9yIGFuIHhociByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX3hockZpeEF1dGhcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBoZWFkZXJzXG4gICAqL1xuICBfeGhyRml4QXV0aChoZWFkZXJzKSB7XG4gICAgaWYgKHRoaXMuc2Vzc2lvblRva2VuICYmICFoZWFkZXJzLkF1dGhvcml6YXRpb24pIHtcbiAgICAgIGhlYWRlcnMuYXV0aG9yaXphdGlvbiA9ICdMYXllciBzZXNzaW9uLXRva2VuPVwiJyArICB0aGlzLnNlc3Npb25Ub2tlbiArICdcIic7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRml4IHJlbGF0aXZlIFVSTHMgdG8gY3JlYXRlIGFic29sdXRlIFVSTHMgbmVlZGVkIGZvciBDT1JTIHJlcXVlc3RzLlxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJGaXhSZWxhdGl2ZVVybHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSByZWxhdGl2ZSBvciBhYnNvbHV0ZSB1cmxcbiAgICogQHJldHVybiB7c3RyaW5nfSBhYnNvbHV0ZSB1cmxcbiAgICovXG4gIF94aHJGaXhSZWxhdGl2ZVVybHModXJsKSB7XG4gICAgbGV0IHJlc3VsdCA9IHVybDtcbiAgICBpZiAodXJsLmluZGV4T2YoJ2h0dHBzOi8vJykgPT09IC0xKSB7XG4gICAgICBpZiAodXJsWzBdID09PSAnLycpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy51cmwgKyB1cmw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnVybCArICcvJyArIHVybDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaXh1cCBhbGwgaGVhZGVycyBpbiBwcmVwYXJhdGlvbiBmb3IgYW4geGhyIGNhbGwuXG4gICAqXG4gICAqIDEuIEFsbCBoZWFkZXJzIHVzZSBsb3dlciBjYXNlIG5hbWVzIGZvciBzdGFuZGFyZC9lYXN5IGxvb2t1cFxuICAgKiAyLiBTZXQgdGhlIGFjY2VwdCBoZWFkZXJcbiAgICogMy4gSWYgbmVlZGVkLCBzZXQgdGhlIGNvbnRlbnQtdHlwZSBoZWFkZXJcbiAgICpcbiAgICogQG1ldGhvZCBfeGhyRml4SGVhZGVyc1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGhlYWRlcnNcbiAgICovXG4gIF94aHJGaXhIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAvLyBSZXBsYWNlIGFsbCBoZWFkZXJzIGluIGFyYml0cmFyeSBjYXNlIHdpdGggYWxsIGxvd2VyIGNhc2VcbiAgICAvLyBmb3IgZWFzeSBtYXRjaGluZy5cbiAgICBjb25zdCBoZWFkZXJOYW1lTGlzdCA9IE9iamVjdC5rZXlzKGhlYWRlcnMpO1xuICAgIGhlYWRlck5hbWVMaXN0LmZvckVhY2goaGVhZGVyTmFtZSA9PiB7XG4gICAgICBpZiAoaGVhZGVyTmFtZSAhPT0gaGVhZGVyTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgIGhlYWRlcnNbaGVhZGVyTmFtZS50b0xvd2VyQ2FzZSgpXSA9IGhlYWRlcnNbaGVhZGVyTmFtZV07XG4gICAgICAgIGRlbGV0ZSBoZWFkZXJzW2hlYWRlck5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCFoZWFkZXJzLmFjY2VwdCkgaGVhZGVycy5hY2NlcHQgPSBBQ0NFUFQ7XG5cbiAgICBpZiAoIWhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKSBoZWFkZXJzWydjb250ZW50LXR5cGUnXSA9ICdhcHBsaWNhdGlvbi9qc29uJztcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgdGhlIHJlc3VsdCBvZiBhbiB4aHIgY2FsbFxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlc3VsdCAgICAgU3RhbmRhcmQgeGhyIHJlc3BvbnNlIG9iamVjdCBmcm9tIHRoZSB4aHIgbGliXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIENhbGxiYWNrIG9uIGNvbXBsZXRpb25cbiAgICovXG4gIF94aHJSZXN1bHQocmVzdWx0LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG5cbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAvLyBSZXBsYWNlIHRoZSByZXNwb25zZSB3aXRoIGEgTGF5ZXJFcnJvciBpbnN0YW5jZVxuICAgICAgaWYgKHJlc3VsdC5kYXRhICYmIHR5cGVvZiByZXN1bHQuZGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5fZ2VuZXJhdGVFcnJvcihyZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBpdHMgYW4gYXV0aGVudGljYXRpb24gZXJyb3IsIHJlYXV0aGVudGljYXRlXG4gICAgICAvLyBkb24ndCBjYWxsIF9yZXNldFNlc3Npb24gYXMgdGhhdCB3aXBlcyBhbGwgZGF0YSBhbmQgc2NyZXdzIHdpdGggVUlzLCBhbmQgdGhlIHVzZXJcbiAgICAgIC8vIGlzIHN0aWxsIGF1dGhlbnRpY2F0ZWQgb24gdGhlIGN1c3RvbWVyJ3MgYXBwIGV2ZW4gaWYgbm90IG9uIExheWVyLlxuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDQwMSAmJiB0aGlzLmlzQXV0aGVudGljYXRlZCkge1xuICAgICAgICBsb2dnZXIud2FybignU0VTU0lPTiBFWFBJUkVEIScpO1xuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZhbHNlO1xuICAgICAgICBpZiAoZ2xvYmFsLmxvY2FsU3RvcmFnZSkgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdkZWF1dGhlbnRpY2F0ZWQnKTtcbiAgICAgICAgdGhpcy5fYXV0aGVudGljYXRlKHJlc3VsdC5kYXRhLmdldE5vbmNlKCkpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3VsdCk7XG4gIH1cblxuICAvKipcbiAgICogVHJhbnNmb3JtcyB4aHIgZXJyb3IgcmVzcG9uc2UgaW50byBhIGxheWVyLkxheWVyRXJyb3IgaW5zdGFuY2UuXG4gICAqXG4gICAqIEFkZHMgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiB0byB0aGUgcmVzdWx0IG9iamVjdCBpbmNsdWRpbmdcbiAgICpcbiAgICogKiB1cmxcbiAgICogKiBkYXRhXG4gICAqXG4gICAqIEBtZXRob2QgX2dlbmVyYXRlRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgLSBSZXN1bHQgb2YgdGhlIHhociBjYWxsXG4gICAqL1xuICBfZ2VuZXJhdGVFcnJvcihyZXN1bHQpIHtcbiAgICByZXN1bHQuZGF0YSA9IG5ldyBMYXllckVycm9yKHJlc3VsdC5kYXRhKTtcbiAgICBpZiAoIXJlc3VsdC5kYXRhLmh0dHBTdGF0dXMpIHJlc3VsdC5kYXRhLmh0dHBTdGF0dXMgPSByZXN1bHQuc3RhdHVzO1xuICAgIHJlc3VsdC5kYXRhLmxvZygpO1xuICB9XG5cbiAgLyogRU5EIENPTU1VTklDQVRJT05TIE1FVEhPRFMgKi9cblxufVxuXG4vKipcbiAqIFN0YXRlIHZhcmlhYmxlOyBpbmRpY2F0ZXMgdGhhdCBjbGllbnQgaXMgY3VycmVudGx5IGF1dGhlbnRpY2F0ZWQgYnkgdGhlIHNlcnZlci5cbiAqIFNob3VsZCBuZXZlciBiZSB0cnVlIGlmIGlzQ29ubmVjdGVkIGlzIGZhbHNlLlxuICogQHR5cGUge0Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuaXNBdXRoZW50aWNhdGVkID0gZmFsc2U7XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyBjdXJyZW50bHkgY29ubmVjdGVkIHRvIHNlcnZlclxuICogKG1heSBub3QgYmUgYXV0aGVudGljYXRlZCB5ZXQpXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuXG4vKipcbiAqIFN0YXRlIHZhcmlhYmxlOyBpbmRpY2F0ZXMgdGhhdCBjbGllbnQgaXMgcmVhZHkgZm9yIHRoZSBhcHAgdG8gdXNlLlxuICogVXNlIHRoZSAncmVhZHknIGV2ZW50IHRvIGJlIG5vdGlmaWVkIHdoZW4gdGhpcyB2YWx1ZSBjaGFuZ2VzIHRvIHRydWUuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuaXNSZWFkeSA9IGZhbHNlO1xuXG4vKipcbiAqIFlvdXIgTGF5ZXIgQXBwbGljYXRpb24gSUQuIFRoaXMgdmFsdWUgY2FuIG5vdCBiZSBjaGFuZ2VkIG9uY2UgY29ubmVjdGVkLlxuICogVG8gZmluZCB5b3VyIExheWVyIEFwcGxpY2F0aW9uIElELCBzZWUgeW91ciBMYXllciBEZXZlbG9wZXIgRGFzaGJvYXJkLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmFwcElkID0gJyc7XG5cbi8qKlxuICogSWRlbnRpdHkgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuSWRlbnRpdHl9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnVzZXIgPSBudWxsO1xuXG4vKipcbiAqIFlvdXIgY3VycmVudCBzZXNzaW9uIHRva2VuIHRoYXQgYXV0aGVudGljYXRlcyB5b3VyIHJlcXVlc3RzLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc2Vzc2lvblRva2VuID0gJyc7XG5cbi8qKlxuICogVVJMIHRvIExheWVyJ3MgV2ViIEFQSSBzZXJ2ZXIuXG4gKlxuICogT25seSBtdWNrIHdpdGggdGhpcyBpZiB0b2xkIHRvIGJ5IExheWVyIFN0YWZmLlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUudXJsID0gJ2h0dHBzOi8vYXBpLmxheWVyLmNvbSc7XG5cbi8qKlxuICogVVJMIHRvIExheWVyJ3MgV2Vic29ja2V0IHNlcnZlci5cbiAqXG4gKiBPbmx5IG11Y2sgd2l0aCB0aGlzIGlmIHRvbGQgdG8gYnkgTGF5ZXIgU3RhZmYuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS53ZWJzb2NrZXRVcmwgPSAnd3NzOi8vd2Vic29ja2V0cy5sYXllci5jb20nO1xuXG4vKipcbiAqIFdlYiBTb2NrZXQgTWFuYWdlclxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0TWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogV2ViIFNvY2tldCBSZXF1ZXN0IE1hbmFnZXJcbiogQHR5cGUge2xheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnNvY2tldFJlcXVlc3RNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBXZWIgU29ja2V0IE1hbmFnZXJcbiAqIEB0eXBlIHtsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnNvY2tldENoYW5nZU1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFNlcnZpY2UgZm9yIG1hbmFnaW5nIG9ubGluZSBhcyB3ZWxsIGFzIG9mZmxpbmUgc2VydmVyIHJlcXVlc3RzXG4gKiBAdHlwZSB7bGF5ZXIuU3luY01hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnN5bmNNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBTZXJ2aWNlIGZvciBtYW5hZ2luZyBvbmxpbmUvb2ZmbGluZSBzdGF0ZSBhbmQgZXZlbnRzXG4gKiBAdHlwZSB7bGF5ZXIuT25saW5lU3RhdGVNYW5hZ2VyfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5vbmxpbmVNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBJZiB0aGlzIGlzIGEgdHJ1c3RlZCBkZXZpY2UsIHRoZW4gd2UgY2FuIHdyaXRlIHBlcnNvbmFsIGRhdGEgdG8gcGVyc2lzdGVudCBtZW1vcnkuXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuaXNUcnVzdGVkRGV2aWNlID0gZmFsc2U7XG5cbi8qKlxuICogVG8gZW5hYmxlIGluZGV4ZWREQiBzdG9yYWdlIG9mIHF1ZXJ5IGRhdGEsIHNldCB0aGlzIHRydWUuICBFeHBlcmltZW50YWwuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1BlcnNpc3RlbmNlRW5hYmxlZCA9IGZhbHNlO1xuXG4vKipcbiAqIElmIHRoaXMgbGF5ZXIuQ2xpZW50LmlzVHJ1c3RlZERldmljZSBpcyB0cnVlLCB0aGVuIHlvdSBjYW4gY29udHJvbCB3aGljaCB0eXBlcyBvZiBkYXRhIGFyZSBwZXJzaXN0ZWQuXG4gKlxuICogTm90ZSB0aGF0IHZhbHVlcyBoZXJlIGFyZSBpZ25vcmVkIGlmIGBpc1BlcnNpc3RlbmNlRW5hYmxlZGAgaGFzbid0IGJlZW4gc2V0IHRvIGB0cnVlYC5cbiAqXG4gKiBQcm9wZXJ0aWVzIG9mIHRoaXMgT2JqZWN0IGNhbiBiZTpcbiAqXG4gKiAqIGlkZW50aXRpZXM6IFdyaXRlIGlkZW50aXRpZXMgdG8gaW5kZXhlZERCPyBUaGlzIGFsbG93cyBmb3IgZmFzdGVyIGluaXRpYWxpemF0aW9uLlxuICogKiBjb252ZXJzYXRpb25zOiBXcml0ZSBjb252ZXJzYXRpb25zIHRvIGluZGV4ZWREQj8gVGhpcyBhbGxvd3MgZm9yIGZhc3RlciByZW5kZXJpbmdcbiAqICAgICAgICAgICAgICAgICAgb2YgYSBDb252ZXJzYXRpb24gTGlzdFxuICogKiBtZXNzYWdlczogV3JpdGUgbWVzc2FnZXMgdG8gaW5kZXhlZERCPyBUaGlzIGFsbG93cyBmb3IgZnVsbCBvZmZsaW5lIGFjY2Vzc1xuICogKiBzeW5jUXVldWU6IFdyaXRlIHJlcXVlc3RzIG1hZGUgd2hpbGUgb2ZmbGluZSB0byBpbmRleGVkREI/ICBUaGlzIGFsbG93cyB0aGUgYXBwXG4gKiAgICAgICAgICAgICAgdG8gY29tcGxldGUgc2VuZGluZyBtZXNzYWdlcyBhZnRlciBiZWluZyByZWxhdW5jaGVkLlxuICogKiBzZXNzaW9uVG9rZW46IFdyaXRlIHRoZSBzZXNzaW9uIHRva2VuIHRvIGxvY2FsU3RvcmFnZSBmb3IgcXVpY2sgcmVhdXRoZW50aWNhdGlvbiBvbiByZWxhdW5jaGluZyB0aGUgYXBwLlxuICpcbiAqICAgICAgbmV3IGxheWVyLkNsaWVudCh7XG4gKiAgICAgICAgaXNUcnVzdGVkRGV2aWNlOiB0cnVlLFxuICogICAgICAgIHBlcnNpc3RlbmNlRmVhdHVyZXM6IHtcbiAqICAgICAgICAgIGNvbnZlcnNhdGlvbnM6IHRydWUsXG4gKiAgICAgICAgICBpZGVudGl0aWVzOiB0cnVlLFxuICogICAgICAgICAgbWVzc2FnZXM6IGZhbHNlLFxuICogICAgICAgICAgc3luY1F1ZXVlOiBmYWxzZSxcbiAqICAgICAgICAgIHNlc3Npb25Ub2tlbjogdHJ1ZVxuICogICAgICAgIH1cbiAqICAgICAgfSk7XG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUucGVyc2lzdGVuY2VGZWF0dXJlcyA9IG51bGw7XG5cbi8qKlxuICogRGF0YWJhc2UgTWFuYWdlciBmb3IgcmVhZC93cml0ZSB0byBJbmRleGVkREJcbiAqIEB0eXBlIHtsYXllci5EYk1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmRiTWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogSWYgYSBkaXNwbGF5IG5hbWUgaXMgbm90IGxvYWRlZCBmb3IgdGhlIHNlc3Npb24gb3duZXIsIHVzZSB0aGlzIG5hbWUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuZGVmYXVsdE93bmVyRGlzcGxheU5hbWUgPSAnWW91JztcblxuLyoqXG4gKiBJcyB0cnVlIGlmIHRoZSBjbGllbnQgaXMgYXV0aGVudGljYXRlZCBhbmQgY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXI7XG4gKlxuICogVHlwaWNhbGx5IHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHRoZXJlIGlzIGEgY29ubmVjdGlvbiB0byB0aGUgc2VydmVyLlxuICpcbiAqIFR5cGljYWxseSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggdGhlIGBvbmxpbmVgIGV2ZW50LlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUsICdpc09ubGluZScsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMub25saW5lTWFuYWdlciAmJiB0aGlzLm9ubGluZU1hbmFnZXIuaXNPbmxpbmU7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBMb2cgbGV2ZWxzOyBvbmUgb2Y6XG4gKlxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLk5PTkVcbiAqICAgICogbGF5ZXIuQ29uc3RhbnRzLkxPRy5FUlJPUlxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLldBUk5cbiAqICAgICogbGF5ZXIuQ29uc3RhbnRzLkxPRy5JTkZPXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuREVCVUdcbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUsICdsb2dMZXZlbCcsIHtcbiAgZW51bWVyYWJsZTogZmFsc2UsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkgeyByZXR1cm4gbG9nZ2VyLmxldmVsOyB9LFxuICBzZXQ6IGZ1bmN0aW9uIHNldCh2YWx1ZSkgeyBsb2dnZXIubGV2ZWwgPSB2YWx1ZTsgfSxcbn0pO1xuXG4vKipcbiAqIFNob3J0IGhhbmQgZm9yIGdldHRpbmcgdGhlIHVzZXJJZCBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLlxuICpcbiAqIENvdWxkIGFsc28ganVzdCB1c2UgY2xpZW50LnVzZXIudXNlcklkXG4gKlxuICogQHR5cGUge3N0cmluZ30gdXNlcklkXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ3VzZXJJZCcsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMudXNlciA/IHRoaXMudXNlci51c2VySWQgOiAnJztcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbiBzZXQoKSB7fSxcbn0pO1xuXG4vKipcbiAqIFRpbWUgdG8gYmUgb2ZmbGluZSBhZnRlciB3aGljaCB3ZSBkb24ndCBkbyBhIFdlYlNvY2tldCBFdmVudHMucmVwbGF5LFxuICogYnV0IGluc3RlYWQganVzdCByZWZyZXNoIGFsbCBvdXIgUXVlcnkgZGF0YS4gIERlZmF1bHRzIHRvIDMwIGhvdXJzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IuUmVzZXRBZnRlck9mZmxpbmVEdXJhdGlvbiA9IDEwMDAgKiA2MCAqIDYwICogMzA7XG5cbi8qKlxuICogTGlzdCBvZiBldmVudHMgc3VwcG9ydGVkIGJ5IHRoaXMgY2xhc3NcbiAqIEBzdGF0aWNcbiAqIEBwcm90ZWN0ZWRcbiAqIEB0eXBlIHtzdHJpbmdbXX1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAvKipcbiAgICogVGhlIGNsaWVudCBpcyByZWFkeSBmb3IgYWN0aW9uXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdyZWFkeScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICByZW5kZXJNeVVJKCk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKi9cbiAgJ3JlYWR5JyxcblxuICAvKipcbiAgICogRmlyZWQgd2hlbiBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlci5cbiAgICogQ3VycmVudGx5IGp1c3QgbWVhbnMgd2UgaGF2ZSBhIG5vbmNlLlxuICAgKiBOb3QgcmVjb21tZW5kZWQgZm9yIHR5cGljYWwgYXBwbGljYXRpb25zLlxuICAgKiBAZXZlbnQgY29ubmVjdGVkXG4gICAqL1xuICAnY29ubmVjdGVkJyxcblxuICAvKipcbiAgICogRmlyZWQgd2hlbiB1bnN1Y2Nlc3NmdWwgaW4gb2J0YWluaW5nIGEgbm9uY2UuXG4gICAqXG4gICAqIE5vdCByZWNvbW1lbmRlZCBmb3IgdHlwaWNhbCBhcHBsaWNhdGlvbnMuXG4gICAqIEBldmVudCBjb25uZWN0ZWQtZXJyb3JcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdjb25uZWN0ZWQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBXZSBub3cgaGF2ZSBhIHNlc3Npb24gYW5kIGFueSByZXF1ZXN0cyB3ZSBzZW5kIGF1Z2h0IHRvIHdvcmsuXG4gICAqIFR5cGljYWxseSB5b3Ugc2hvdWxkIHVzZSB0aGUgcmVhZHkgZXZlbnQgaW5zdGVhZCBvZiB0aGUgYXV0aGVudGljYXRlZCBldmVudC5cbiAgICogQGV2ZW50IGF1dGhlbnRpY2F0ZWRcbiAgICovXG4gICdhdXRoZW50aWNhdGVkJyxcblxuICAvKipcbiAgICogRmFpbGVkIHRvIGF1dGhlbnRpY2F0ZSB5b3VyIGNsaWVudC5cbiAgICpcbiAgICogRWl0aGVyIHlvdXIgaWRlbnRpdHktdG9rZW4gd2FzIGludmFsaWQsIG9yIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAqIHVzaW5nIHlvdXIgaWRlbnRpdHktdG9rZW4uXG4gICAqXG4gICAqIEBldmVudCBhdXRoZW50aWNhdGVkLWVycm9yXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2ZW50LmVycm9yXG4gICAqL1xuICAnYXV0aGVudGljYXRlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoaXMgZXZlbnQgZmlyZXMgd2hlbiBhIHNlc3Npb24gaGFzIGV4cGlyZWQgb3Igd2hlbiBgbGF5ZXIuQ2xpZW50LmxvZ291dGAgaXMgY2FsbGVkLlxuICAgKiBUeXBpY2FsbHksIGl0IGlzIGVub3VnaCB0byBzdWJzY3JpYmUgdG8gdGhlIGNoYWxsZW5nZSBldmVudFxuICAgKiB3aGljaCB3aWxsIGxldCB5b3UgcmVhdXRoZW50aWNhdGU7IHR5cGljYWwgYXBwbGljYXRpb25zIGRvIG5vdCBuZWVkXG4gICAqIHRvIHN1YnNjcmliZSB0byB0aGlzLlxuICAgKlxuICAgKiBAZXZlbnQgZGVhdXRoZW50aWNhdGVkXG4gICAqL1xuICAnZGVhdXRoZW50aWNhdGVkJyxcblxuICAvKipcbiAgICogQGV2ZW50IGNoYWxsZW5nZVxuICAgKiBWZXJpZnkgdGhlIHVzZXIncyBpZGVudGl0eS5cbiAgICpcbiAgICogVGhpcyBldmVudCBpcyB3aGVyZSB5b3UgdmVyaWZ5IHRoYXQgdGhlIHVzZXIgaXMgd2hvIHdlIGFsbCB0aGluayB0aGUgdXNlciBpcyxcbiAgICogYW5kIHByb3ZpZGUgYW4gaWRlbnRpdHkgdG9rZW4gdG8gdmFsaWRhdGUgdGhhdC5cbiAgICpcbiAgICogYGBgamF2YXNjcmlwdFxuICAgKiBjbGllbnQub24oJ2NoYWxsZW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBteUdldElkZW50aXR5Rm9yTm9uY2UoZXZ0Lm5vbmNlLCBmdW5jdGlvbihpZGVudGl0eVRva2VuKSB7XG4gICAqICAgICAgZXZ0LmNhbGxiYWNrKGlkZW50aXR5VG9rZW4pO1xuICAgKiAgICB9KTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50Lm5vbmNlIC0gQSBub25jZSBmb3IgeW91IHRvIHByb3ZpZGUgdG8geW91ciBpZGVudGl0eSBwcm92aWRlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBldmVudC5jYWxsYmFjayAtIENhbGwgdGhpcyBvbmNlIHlvdSBoYXZlIGFuIGlkZW50aXR5LXRva2VuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5jYWxsYmFjay5pZGVudGl0eVRva2VuIC0gSWRlbnRpdHkgdG9rZW4gcHJvdmlkZWQgYnkgeW91ciBpZGVudGl0eSBwcm92aWRlciBzZXJ2aWNlXG4gICAqL1xuICAnY2hhbGxlbmdlJyxcblxuICAvKipcbiAgICogQGV2ZW50IHNlc3Npb24tdGVybWluYXRlZFxuICAgKiBJZiB5b3VyIHNlc3Npb24gaGFzIGJlZW4gdGVybWluYXRlZCBpbiBzdWNoIGEgd2F5IGFzIHRvIHByZXZlbnQgYXV0b21hdGljIHJlY29ubmVjdCxcbiAgICpcbiAgICogdGhpcyBldmVudCB3aWxsIGZpcmUuICBDb21tb24gc2NlbmFyaW86IHVzZXIgaGFzIHR3byB0YWJzIG9wZW47XG4gICAqIG9uZSB0YWIgdGhlIHVzZXIgbG9ncyBvdXQgKG9yIHlvdSBjYWxsIGNsaWVudC5sb2dvdXQoKSkuXG4gICAqIFRoZSBvdGhlciB0YWIgd2lsbCBkZXRlY3QgdGhhdCB0aGUgc2Vzc2lvblRva2VuIGhhcyBiZWVuIHJlbW92ZWQsXG4gICAqIGFuZCB3aWxsIHRlcm1pbmF0ZSBpdHMgc2Vzc2lvbiBhcyB3ZWxsLiAgSW4gdGhpcyBzY2VuYXJpbyB3ZSBkbyBub3Qgd2FudFxuICAgKiB0byBhdXRvbWF0aWNhbGx5IHRyaWdnZXIgYSBjaGFsbGVuZ2UgYW5kIHJlc3RhcnQgdGhlIGxvZ2luIHByb2Nlc3MuXG4gICAqL1xuICAnc2Vzc2lvbi10ZXJtaW5hdGVkJyxcblxuICAvKipcbiAgICogQGV2ZW50IG9ubGluZVxuICAgKlxuICAgKiBUaGlzIGV2ZW50IGlzIHVzZWQgdG8gZGV0ZWN0IHdoZW4gdGhlIGNsaWVudCBpcyBvbmxpbmUgKGNvbm5lY3RlZCB0byB0aGUgc2VydmVyKVxuICAgKiBvciBvZmZsaW5lIChzdGlsbCBhYmxlIHRvIGFjY2VwdCBBUEkgY2FsbHMgYnV0IG5vIGxvbmdlciBhYmxlIHRvIHN5bmMgdG8gdGhlIHNlcnZlcikuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdvbmxpbmUnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICBpZiAoZXZ0LmlzT25saW5lKSB7XG4gICAqICAgICAgICAgICAgIHN0YXR1c0Rpdi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnZ3JlZW4nO1xuICAgKiAgICAgICAgIH0gZWxzZSB7XG4gICAqICAgICAgICAgICAgIHN0YXR1c0Rpdi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmVkJztcbiAgICogICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudFxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGV2ZW50LmlzT25saW5lXG4gICAqL1xuICAnb25saW5lJyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KENsaWVudEF1dGhlbnRpY2F0b3IsIFtDbGllbnRBdXRoZW50aWNhdG9yLCAnQ2xpZW50QXV0aGVudGljYXRvciddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbGllbnRBdXRoZW50aWNhdG9yO1xuIl19
