'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This class manages a state variable for whether we are online/offline, triggers events
 * when the state changes, and determines when to perform tests to validate our online status.
 *
 * It performs the following tasks:
 *
 * 1. Any time we go more than this.pingFrequency (100 seconds) without any data from the server, flag us as being offline.
 *    Rationale: The websocket manager is calling `getCounter` every 30 seconds; so it would have had to fail to get any response
 *    3 times before we give up.
 * 2. While we are offline, ping the server until we determine we are in fact able to connect to the server
 * 3. Trigger events `connected` and `disconnected` to let the rest of the system know when we are/are not connected.
 *    NOTE: The Websocket manager will use that to reconnect its websocket, and resume its `getCounter` call every 30 seconds.
 *
 * NOTE: Apps that want to be notified of changes to online/offline state should see layer.Client's `online` event.
 *
 * NOTE: One iteration of this class treated navigator.onLine = false as fact.  If onLine is false, then we don't need to test
 * anything.  If its true, then this class verifies it can reach layer's servers.  However, https://code.google.com/p/chromium/issues/detail?id=277372 has replicated multiple times in chrome; this bug causes one tab of chrome to have navigator.onLine=false while all other tabs
 * correctly report navigator.onLine=true.  As a result, we can't rely on this value and this class must continue to poll the server while
 * offline and to ignore values from navigator.onLine.  Future Work: Allow non-chrome browsers to use navigator.onLine.
 *
 * @class  layer.OnlineStateManager
 * @private
 * @extends layer.Root
 *
 */
var Root = require('./root');
var xhr = require('./xhr');
var logger = require('./logger');
var Utils = require('./client-utils');

var _require = require('./const'),
    ACCEPT = _require.ACCEPT;

var OnlineStateManager = function (_Root) {
  _inherits(OnlineStateManager, _Root);

  /**
   * Creates a new OnlineStateManager.
   *
   * An Application is expected to only have one of these.
   *
   *      var onlineStateManager = new layer.OnlineStateManager({
   *          socketManager: socketManager,
   *          testUrl: 'https://api.layer.com/nonces'
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {layer.Websockets.SocketManager} options.socketManager - A websocket manager to monitor for messages
   * @param  {string} options.testUrl - A url to send requests to when testing if we are online
   */
  function OnlineStateManager(options) {
    _classCallCheck(this, OnlineStateManager);

    // Listen to all xhr events and websocket messages for online-status info
    var _this = _possibleConstructorReturn(this, (OnlineStateManager.__proto__ || Object.getPrototypeOf(OnlineStateManager)).call(this, options));

    xhr.addConnectionListener(function (evt) {
      return _this._connectionListener(evt);
    });
    _this.socketManager.on('message', function () {
      return _this._connectionListener({ status: 'connection:success' });
    }, _this);

    // Any change in online status reported by the browser should result in
    // an immediate update to our online/offline state
    /* istanbul ignore else */
    if (typeof window !== 'undefined') {
      window.addEventListener('online', _this._handleOnlineEvent.bind(_this));
      window.addEventListener('offline', _this._handleOnlineEvent.bind(_this));
    }
    return _this;
  }

  /**
   * We don't actually start managing our online state until after the client has authenticated.
   * Call start() when we are ready for the client to start managing our state.
   *
   * The client won't call start() without first validating that we have a valid session, so by definition,
   * calling start means we are online.
   *
   * @method start
   */


  _createClass(OnlineStateManager, [{
    key: 'start',
    value: function start() {
      logger.info('OnlineStateManager: start');
      this.isClientReady = true;
      this.isOnline = true;

      this.checkOnlineStatus();
    }

    /**
     * If the client becomes unauthenticated, stop checking if we are online, and announce that we are offline.
     *
     * @method stop
     */

  }, {
    key: 'stop',
    value: function stop() {
      logger.info('OnlineStateManager: stop');
      this.isClientReady = false;
      this._clearCheck();
      this._changeToOffline();
    }

    /**
     * Schedules our next call to _onlineExpired if online or checkOnlineStatus if offline.
     *
     * @method _scheduleNextOnlineCheck
     * @private
     */

  }, {
    key: '_scheduleNextOnlineCheck',
    value: function _scheduleNextOnlineCheck() {
      logger.debug('OnlineStateManager: skip schedule');
      if (this.isDestroyed || !this.isClientReady) return;

      // Replace any scheduled calls with the newly scheduled call:
      this._clearCheck();

      // If this is called while we are online, then we are using this to detect when we've gone without data for more than pingFrequency.
      // Call this._onlineExpired after pingFrequency of no server responses.
      if (this.isOnline) {
        logger.debug('OnlineStateManager: Scheduled onlineExpired');
        this.onlineCheckId = setTimeout(this._onlineExpired.bind(this), this.pingFrequency);
      }

      // If this is called while we are offline, we're doing exponential backoff pinging the server to see if we've come back online.
      else {
          logger.info('OnlineStateManager: Scheduled checkOnlineStatus');
          var duration = Utils.getExponentialBackoffSeconds(this.maxOfflineWait, Math.min(10, this.offlineCounter++));
          this.onlineCheckId = setTimeout(this.checkOnlineStatus.bind(this), Math.floor(duration * 1000));
        }
    }

    /**
     * Cancels any upcoming calls to checkOnlineStatus
     *
     * @method _clearCheck
     * @private
     */

  }, {
    key: '_clearCheck',
    value: function _clearCheck() {
      if (this.onlineCheckId) {
        clearTimeout(this.onlineCheckId);
        this.onlineCheckId = 0;
      }
    }

    /**
     * Respond to the browser's online/offline events.
     *
     * Our response is not to trust them, but to use them as
     * a trigger to indicate we should immediately do our own
     * validation.
     *
     * @method _handleOnlineEvent
     * @private
     * @param  {Event} evt - Browser online/offline event object
     */

  }, {
    key: '_handleOnlineEvent',
    value: function _handleOnlineEvent(evt) {
      // Reset the counter because our first request may fail as they may not be
      // fully connected yet
      this.offlineCounter = 0;
      this.checkOnlineStatus();
    }

    /**
     * Our online state has expired; we are now offline.
     *
     * If this method gets called, it means that our connection has gone too long without any data
     * and is now considered to be disconnected.  Start scheduling tests to see when we are back online.
     *
     * @method _onlineExpired
     * @private
     */

  }, {
    key: '_onlineExpired',
    value: function _onlineExpired() {
      this._clearCheck();
      this._changeToOffline();
      this._scheduleNextOnlineCheck();
    }

    /**
     * Get a nonce to see if we can reach the server.
     *
     * We don't care about the result,
     * we just care about triggering a 'connection:success' or 'connection:error' event
     * which connectionListener will respond to.
     *
     *      client.onlineManager.checkOnlineStatus(function(result) {
     *          alert(result ? 'We're online!' : 'Doh!');
     *      });
     *
     * @method checkOnlineStatus
     * @param {Function} callback
     * @param {boolean} callback.isOnline - Callback is called with true if online, false if not
     */

  }, {
    key: 'checkOnlineStatus',
    value: function checkOnlineStatus(callback) {
      var _this2 = this;

      this._clearCheck();

      logger.info('OnlineStateManager: Firing XHR for online check');
      this._lastCheckOnlineStatus = new Date();
      // Ping the server and see if we're connected.
      xhr({
        url: this.testUrl,
        method: 'POST',
        headers: {
          accept: ACCEPT
        }
      }, function () {
        // this.isOnline will be updated via _connectionListener prior to this line executing
        if (callback) callback(_this2.isOnline);
      });
    }

    /**
     * On determining that we are offline, handles the state transition and logging.
     *
     * @method _changeToOffline
     * @private
     */

  }, {
    key: '_changeToOffline',
    value: function _changeToOffline() {
      if (this.isOnline) {
        this.isOnline = false;
        this.trigger('disconnected');
        logger.info('OnlineStateManager: Connection lost');
      }
    }

    /**
     * Called whenever a websocket event arrives, or an xhr call completes; updates our isOnline state.
     *
     * Any call to this method will reschedule our next is-online test
     *
     * @method _connectionListener
     * @private
     * @param  {string} evt - Name of the event; either 'connection:success' or 'connection:error'
     */

  }, {
    key: '_connectionListener',
    value: function _connectionListener(evt) {
      // If event is a success, change us to online
      if (evt.status === 'connection:success') {
        var lastTime = this.lastMessageTime;
        this.lastMessageTime = new Date();
        if (!this.isOnline) {
          this.isOnline = true;
          this.offlineCounter = 0;
          this.trigger('connected', { offlineDuration: lastTime ? Date.now() - lastTime : 0 });
          if (this.connectedCounter === undefined) this.connectedCounter = 0;
          this.connectedCounter++;
          logger.info('OnlineStateManager: Connected restored');
        }
      }

      // If event is NOT success, change us to offline.
      else {
          this._changeToOffline();
        }

      this._scheduleNextOnlineCheck();
    }

    /**
     * Cleanup/shutdown
     *
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      this._clearCheck();
      this.socketManager = null;
      _get(OnlineStateManager.prototype.__proto__ || Object.getPrototypeOf(OnlineStateManager.prototype), 'destroy', this).call(this);
    }
  }]);

  return OnlineStateManager;
}(Root);

OnlineStateManager.prototype.isClientReady = false;

/**
 * URL To fire when testing to see if we are online.
 * @type {String}
 */
OnlineStateManager.prototype.testUrl = '';

/**
 * A Websocket manager whose 'message' event we will listen to
 * in order to know that we are still online.
 * @type {layer.Websockets.SocketManager}
 */
OnlineStateManager.prototype.socketManager = null;

/**
 * Number of testUrl requests we've been offline for.
 *
 * Will stop growing once the number is suitably large (10-20).
 * @type {Number}
 */
OnlineStateManager.prototype.offlineCounter = 0;

/**
 * Maximum wait during exponential backoff while offline.
 *
 * While offline, exponential backoff is used to calculate how long to wait between checking with the server
 * to see if we are online again. This value determines the maximum wait; any higher value returned by exponential backoff
 * are ignored and this value used instead.
 * Value is measured in seconds.
 * @type {Number}
 */
OnlineStateManager.prototype.maxOfflineWait = 5 * 60;

/**
 * Minimum wait between tries in ms.
 * @type {Number}
 */
OnlineStateManager.prototype.minBackoffWait = 100;

/**
 * Time that the last successful message was observed.
 * @type {Date}
 */
OnlineStateManager.prototype.lastMessageTime = null;

/**
 * For debugging, tracks the last time we checked if we are online.
 * @type {Date}
 */
OnlineStateManager.prototype._lastCheckOnlineStatus = null;

/**
 * Are we currently online?
 * @type {Boolean}
 */
OnlineStateManager.prototype.isOnline = false;

/**
 * setTimeoutId for the next checkOnlineStatus() call.
 * @type {Number}
 */
OnlineStateManager.prototype.onlineCheckId = 0;

/**
 * If we are online, how often do we need to ping to verify we are still online.
 *
 * Value is reset any time we observe any messages from the server.
 * Measured in miliseconds. NOTE: Websocket has a separate ping which mostly makes
 * this one unnecessary.  May end up removing this one... though we'd keep the
 * ping for when our state is offline.
 * @type {Number}
 */
OnlineStateManager.prototype.pingFrequency = 100 * 1000;

OnlineStateManager._supportedEvents = [
/**
 * We appear to be online and able to send and receive
 * @event connected
 * @param {number} onlineDuration - Number of miliseconds since we were last known to be online
 */
'connected',

/**
 * We appear to be offline and unable to send or receive
 * @event disconnected
 */
'disconnected'].concat(Root._supportedEvents);
Root.initClass.apply(OnlineStateManager, [OnlineStateManager, 'OnlineStateManager']);
module.exports = OnlineStateManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9vbmxpbmUtc3RhdGUtbWFuYWdlci5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsInhociIsImxvZ2dlciIsIlV0aWxzIiwiQUNDRVBUIiwiT25saW5lU3RhdGVNYW5hZ2VyIiwib3B0aW9ucyIsImFkZENvbm5lY3Rpb25MaXN0ZW5lciIsIl9jb25uZWN0aW9uTGlzdGVuZXIiLCJldnQiLCJzb2NrZXRNYW5hZ2VyIiwib24iLCJzdGF0dXMiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwiX2hhbmRsZU9ubGluZUV2ZW50IiwiYmluZCIsImluZm8iLCJpc0NsaWVudFJlYWR5IiwiaXNPbmxpbmUiLCJjaGVja09ubGluZVN0YXR1cyIsIl9jbGVhckNoZWNrIiwiX2NoYW5nZVRvT2ZmbGluZSIsImRlYnVnIiwiaXNEZXN0cm95ZWQiLCJvbmxpbmVDaGVja0lkIiwic2V0VGltZW91dCIsIl9vbmxpbmVFeHBpcmVkIiwicGluZ0ZyZXF1ZW5jeSIsImR1cmF0aW9uIiwiZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyIsIm1heE9mZmxpbmVXYWl0IiwiTWF0aCIsIm1pbiIsIm9mZmxpbmVDb3VudGVyIiwiZmxvb3IiLCJjbGVhclRpbWVvdXQiLCJfc2NoZWR1bGVOZXh0T25saW5lQ2hlY2siLCJjYWxsYmFjayIsIl9sYXN0Q2hlY2tPbmxpbmVTdGF0dXMiLCJEYXRlIiwidXJsIiwidGVzdFVybCIsIm1ldGhvZCIsImhlYWRlcnMiLCJhY2NlcHQiLCJ0cmlnZ2VyIiwibGFzdFRpbWUiLCJsYXN0TWVzc2FnZVRpbWUiLCJvZmZsaW5lRHVyYXRpb24iLCJub3ciLCJjb25uZWN0ZWRDb3VudGVyIiwidW5kZWZpbmVkIiwicHJvdG90eXBlIiwibWluQmFja29mZldhaXQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFB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QyxLQUFmLENBQXFCckQsa0JBQXJCLEVBQXlDLENBQUNBLGtCQUFELEVBQXFCLG9CQUFyQixDQUF6QztBQUNBc0QsT0FBT0MsT0FBUCxHQUFpQnZELGtCQUFqQiIsImZpbGUiOiJvbmxpbmUtc3RhdGUtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhpcyBjbGFzcyBtYW5hZ2VzIGEgc3RhdGUgdmFyaWFibGUgZm9yIHdoZXRoZXIgd2UgYXJlIG9ubGluZS9vZmZsaW5lLCB0cmlnZ2VycyBldmVudHNcbiAqIHdoZW4gdGhlIHN0YXRlIGNoYW5nZXMsIGFuZCBkZXRlcm1pbmVzIHdoZW4gdG8gcGVyZm9ybSB0ZXN0cyB0byB2YWxpZGF0ZSBvdXIgb25saW5lIHN0YXR1cy5cbiAqXG4gKiBJdCBwZXJmb3JtcyB0aGUgZm9sbG93aW5nIHRhc2tzOlxuICpcbiAqIDEuIEFueSB0aW1lIHdlIGdvIG1vcmUgdGhhbiB0aGlzLnBpbmdGcmVxdWVuY3kgKDEwMCBzZWNvbmRzKSB3aXRob3V0IGFueSBkYXRhIGZyb20gdGhlIHNlcnZlciwgZmxhZyB1cyBhcyBiZWluZyBvZmZsaW5lLlxuICogICAgUmF0aW9uYWxlOiBUaGUgd2Vic29ja2V0IG1hbmFnZXIgaXMgY2FsbGluZyBgZ2V0Q291bnRlcmAgZXZlcnkgMzAgc2Vjb25kczsgc28gaXQgd291bGQgaGF2ZSBoYWQgdG8gZmFpbCB0byBnZXQgYW55IHJlc3BvbnNlXG4gKiAgICAzIHRpbWVzIGJlZm9yZSB3ZSBnaXZlIHVwLlxuICogMi4gV2hpbGUgd2UgYXJlIG9mZmxpbmUsIHBpbmcgdGhlIHNlcnZlciB1bnRpbCB3ZSBkZXRlcm1pbmUgd2UgYXJlIGluIGZhY3QgYWJsZSB0byBjb25uZWN0IHRvIHRoZSBzZXJ2ZXJcbiAqIDMuIFRyaWdnZXIgZXZlbnRzIGBjb25uZWN0ZWRgIGFuZCBgZGlzY29ubmVjdGVkYCB0byBsZXQgdGhlIHJlc3Qgb2YgdGhlIHN5c3RlbSBrbm93IHdoZW4gd2UgYXJlL2FyZSBub3QgY29ubmVjdGVkLlxuICogICAgTk9URTogVGhlIFdlYnNvY2tldCBtYW5hZ2VyIHdpbGwgdXNlIHRoYXQgdG8gcmVjb25uZWN0IGl0cyB3ZWJzb2NrZXQsIGFuZCByZXN1bWUgaXRzIGBnZXRDb3VudGVyYCBjYWxsIGV2ZXJ5IDMwIHNlY29uZHMuXG4gKlxuICogTk9URTogQXBwcyB0aGF0IHdhbnQgdG8gYmUgbm90aWZpZWQgb2YgY2hhbmdlcyB0byBvbmxpbmUvb2ZmbGluZSBzdGF0ZSBzaG91bGQgc2VlIGxheWVyLkNsaWVudCdzIGBvbmxpbmVgIGV2ZW50LlxuICpcbiAqIE5PVEU6IE9uZSBpdGVyYXRpb24gb2YgdGhpcyBjbGFzcyB0cmVhdGVkIG5hdmlnYXRvci5vbkxpbmUgPSBmYWxzZSBhcyBmYWN0LiAgSWYgb25MaW5lIGlzIGZhbHNlLCB0aGVuIHdlIGRvbid0IG5lZWQgdG8gdGVzdFxuICogYW55dGhpbmcuICBJZiBpdHMgdHJ1ZSwgdGhlbiB0aGlzIGNsYXNzIHZlcmlmaWVzIGl0IGNhbiByZWFjaCBsYXllcidzIHNlcnZlcnMuICBIb3dldmVyLCBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9Mjc3MzcyIGhhcyByZXBsaWNhdGVkIG11bHRpcGxlIHRpbWVzIGluIGNocm9tZTsgdGhpcyBidWcgY2F1c2VzIG9uZSB0YWIgb2YgY2hyb21lIHRvIGhhdmUgbmF2aWdhdG9yLm9uTGluZT1mYWxzZSB3aGlsZSBhbGwgb3RoZXIgdGFic1xuICogY29ycmVjdGx5IHJlcG9ydCBuYXZpZ2F0b3Iub25MaW5lPXRydWUuICBBcyBhIHJlc3VsdCwgd2UgY2FuJ3QgcmVseSBvbiB0aGlzIHZhbHVlIGFuZCB0aGlzIGNsYXNzIG11c3QgY29udGludWUgdG8gcG9sbCB0aGUgc2VydmVyIHdoaWxlXG4gKiBvZmZsaW5lIGFuZCB0byBpZ25vcmUgdmFsdWVzIGZyb20gbmF2aWdhdG9yLm9uTGluZS4gIEZ1dHVyZSBXb3JrOiBBbGxvdyBub24tY2hyb21lIGJyb3dzZXJzIHRvIHVzZSBuYXZpZ2F0b3Iub25MaW5lLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuT25saW5lU3RhdGVNYW5hZ2VyXG4gKiBAcHJpdmF0ZVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICpcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgeGhyID0gcmVxdWlyZSgnLi94aHInKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCB7IEFDQ0VQVCB9ID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuXG5jbGFzcyBPbmxpbmVTdGF0ZU1hbmFnZXIgZXh0ZW5kcyBSb290IHtcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgT25saW5lU3RhdGVNYW5hZ2VyLlxuICAgKlxuICAgKiBBbiBBcHBsaWNhdGlvbiBpcyBleHBlY3RlZCB0byBvbmx5IGhhdmUgb25lIG9mIHRoZXNlLlxuICAgKlxuICAgKiAgICAgIHZhciBvbmxpbmVTdGF0ZU1hbmFnZXIgPSBuZXcgbGF5ZXIuT25saW5lU3RhdGVNYW5hZ2VyKHtcbiAgICogICAgICAgICAgc29ja2V0TWFuYWdlcjogc29ja2V0TWFuYWdlcixcbiAgICogICAgICAgICAgdGVzdFVybDogJ2h0dHBzOi8vYXBpLmxheWVyLmNvbS9ub25jZXMnXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSAge2xheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcn0gb3B0aW9ucy5zb2NrZXRNYW5hZ2VyIC0gQSB3ZWJzb2NrZXQgbWFuYWdlciB0byBtb25pdG9yIGZvciBtZXNzYWdlc1xuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9wdGlvbnMudGVzdFVybCAtIEEgdXJsIHRvIHNlbmQgcmVxdWVzdHMgdG8gd2hlbiB0ZXN0aW5nIGlmIHdlIGFyZSBvbmxpbmVcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIExpc3RlbiB0byBhbGwgeGhyIGV2ZW50cyBhbmQgd2Vic29ja2V0IG1lc3NhZ2VzIGZvciBvbmxpbmUtc3RhdHVzIGluZm9cbiAgICB4aHIuYWRkQ29ubmVjdGlvbkxpc3RlbmVyKGV2dCA9PiB0aGlzLl9jb25uZWN0aW9uTGlzdGVuZXIoZXZ0KSk7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLm9uKCdtZXNzYWdlJywgKCkgPT4gdGhpcy5fY29ubmVjdGlvbkxpc3RlbmVyKHsgc3RhdHVzOiAnY29ubmVjdGlvbjpzdWNjZXNzJyB9KSwgdGhpcyk7XG5cbiAgICAvLyBBbnkgY2hhbmdlIGluIG9ubGluZSBzdGF0dXMgcmVwb3J0ZWQgYnkgdGhlIGJyb3dzZXIgc2hvdWxkIHJlc3VsdCBpblxuICAgIC8vIGFuIGltbWVkaWF0ZSB1cGRhdGUgdG8gb3VyIG9ubGluZS9vZmZsaW5lIHN0YXRlXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvbmxpbmUnLCB0aGlzLl9oYW5kbGVPbmxpbmVFdmVudC5iaW5kKHRoaXMpKTtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvZmZsaW5lJywgdGhpcy5faGFuZGxlT25saW5lRXZlbnQuYmluZCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdlIGRvbid0IGFjdHVhbGx5IHN0YXJ0IG1hbmFnaW5nIG91ciBvbmxpbmUgc3RhdGUgdW50aWwgYWZ0ZXIgdGhlIGNsaWVudCBoYXMgYXV0aGVudGljYXRlZC5cbiAgICogQ2FsbCBzdGFydCgpIHdoZW4gd2UgYXJlIHJlYWR5IGZvciB0aGUgY2xpZW50IHRvIHN0YXJ0IG1hbmFnaW5nIG91ciBzdGF0ZS5cbiAgICpcbiAgICogVGhlIGNsaWVudCB3b24ndCBjYWxsIHN0YXJ0KCkgd2l0aG91dCBmaXJzdCB2YWxpZGF0aW5nIHRoYXQgd2UgaGF2ZSBhIHZhbGlkIHNlc3Npb24sIHNvIGJ5IGRlZmluaXRpb24sXG4gICAqIGNhbGxpbmcgc3RhcnQgbWVhbnMgd2UgYXJlIG9ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBzdGFydFxuICAgKi9cbiAgc3RhcnQoKSB7XG4gICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogc3RhcnQnKTtcbiAgICB0aGlzLmlzQ2xpZW50UmVhZHkgPSB0cnVlO1xuICAgIHRoaXMuaXNPbmxpbmUgPSB0cnVlO1xuXG4gICAgdGhpcy5jaGVja09ubGluZVN0YXR1cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBjbGllbnQgYmVjb21lcyB1bmF1dGhlbnRpY2F0ZWQsIHN0b3AgY2hlY2tpbmcgaWYgd2UgYXJlIG9ubGluZSwgYW5kIGFubm91bmNlIHRoYXQgd2UgYXJlIG9mZmxpbmUuXG4gICAqXG4gICAqIEBtZXRob2Qgc3RvcFxuICAgKi9cbiAgc3RvcCgpIHtcbiAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBzdG9wJyk7XG4gICAgdGhpcy5pc0NsaWVudFJlYWR5ID0gZmFsc2U7XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuICAgIHRoaXMuX2NoYW5nZVRvT2ZmbGluZSgpO1xuICB9XG5cblxuICAvKipcbiAgICogU2NoZWR1bGVzIG91ciBuZXh0IGNhbGwgdG8gX29ubGluZUV4cGlyZWQgaWYgb25saW5lIG9yIGNoZWNrT25saW5lU3RhdHVzIGlmIG9mZmxpbmUuXG4gICAqXG4gICAqIEBtZXRob2QgX3NjaGVkdWxlTmV4dE9ubGluZUNoZWNrXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc2NoZWR1bGVOZXh0T25saW5lQ2hlY2soKSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IHNraXAgc2NoZWR1bGUnKTtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCB8fCAhdGhpcy5pc0NsaWVudFJlYWR5KSByZXR1cm47XG5cbiAgICAvLyBSZXBsYWNlIGFueSBzY2hlZHVsZWQgY2FsbHMgd2l0aCB0aGUgbmV3bHkgc2NoZWR1bGVkIGNhbGw6XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuXG4gICAgLy8gSWYgdGhpcyBpcyBjYWxsZWQgd2hpbGUgd2UgYXJlIG9ubGluZSwgdGhlbiB3ZSBhcmUgdXNpbmcgdGhpcyB0byBkZXRlY3Qgd2hlbiB3ZSd2ZSBnb25lIHdpdGhvdXQgZGF0YSBmb3IgbW9yZSB0aGFuIHBpbmdGcmVxdWVuY3kuXG4gICAgLy8gQ2FsbCB0aGlzLl9vbmxpbmVFeHBpcmVkIGFmdGVyIHBpbmdGcmVxdWVuY3kgb2Ygbm8gc2VydmVyIHJlc3BvbnNlcy5cbiAgICBpZiAodGhpcy5pc09ubGluZSkge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IFNjaGVkdWxlZCBvbmxpbmVFeHBpcmVkJyk7XG4gICAgICB0aGlzLm9ubGluZUNoZWNrSWQgPSBzZXRUaW1lb3V0KHRoaXMuX29ubGluZUV4cGlyZWQuYmluZCh0aGlzKSwgdGhpcy5waW5nRnJlcXVlbmN5KTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGNhbGxlZCB3aGlsZSB3ZSBhcmUgb2ZmbGluZSwgd2UncmUgZG9pbmcgZXhwb25lbnRpYWwgYmFja29mZiBwaW5naW5nIHRoZSBzZXJ2ZXIgdG8gc2VlIGlmIHdlJ3ZlIGNvbWUgYmFjayBvbmxpbmUuXG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBTY2hlZHVsZWQgY2hlY2tPbmxpbmVTdGF0dXMnKTtcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyh0aGlzLm1heE9mZmxpbmVXYWl0LCBNYXRoLm1pbigxMCwgdGhpcy5vZmZsaW5lQ291bnRlcisrKSk7XG4gICAgICB0aGlzLm9ubGluZUNoZWNrSWQgPSBzZXRUaW1lb3V0KHRoaXMuY2hlY2tPbmxpbmVTdGF0dXMuYmluZCh0aGlzKSwgTWF0aC5mbG9vcihkdXJhdGlvbiAqIDEwMDApKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FuY2VscyBhbnkgdXBjb21pbmcgY2FsbHMgdG8gY2hlY2tPbmxpbmVTdGF0dXNcbiAgICpcbiAgICogQG1ldGhvZCBfY2xlYXJDaGVja1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NsZWFyQ2hlY2soKSB7XG4gICAgaWYgKHRoaXMub25saW5lQ2hlY2tJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMub25saW5lQ2hlY2tJZCk7XG4gICAgICB0aGlzLm9ubGluZUNoZWNrSWQgPSAwO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNwb25kIHRvIHRoZSBicm93c2VyJ3Mgb25saW5lL29mZmxpbmUgZXZlbnRzLlxuICAgKlxuICAgKiBPdXIgcmVzcG9uc2UgaXMgbm90IHRvIHRydXN0IHRoZW0sIGJ1dCB0byB1c2UgdGhlbSBhc1xuICAgKiBhIHRyaWdnZXIgdG8gaW5kaWNhdGUgd2Ugc2hvdWxkIGltbWVkaWF0ZWx5IGRvIG91ciBvd25cbiAgICogdmFsaWRhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlT25saW5lRXZlbnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7RXZlbnR9IGV2dCAtIEJyb3dzZXIgb25saW5lL29mZmxpbmUgZXZlbnQgb2JqZWN0XG4gICAqL1xuICBfaGFuZGxlT25saW5lRXZlbnQoZXZ0KSB7XG4gICAgLy8gUmVzZXQgdGhlIGNvdW50ZXIgYmVjYXVzZSBvdXIgZmlyc3QgcmVxdWVzdCBtYXkgZmFpbCBhcyB0aGV5IG1heSBub3QgYmVcbiAgICAvLyBmdWxseSBjb25uZWN0ZWQgeWV0XG4gICAgdGhpcy5vZmZsaW5lQ291bnRlciA9IDA7XG4gICAgdGhpcy5jaGVja09ubGluZVN0YXR1cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIE91ciBvbmxpbmUgc3RhdGUgaGFzIGV4cGlyZWQ7IHdlIGFyZSBub3cgb2ZmbGluZS5cbiAgICpcbiAgICogSWYgdGhpcyBtZXRob2QgZ2V0cyBjYWxsZWQsIGl0IG1lYW5zIHRoYXQgb3VyIGNvbm5lY3Rpb24gaGFzIGdvbmUgdG9vIGxvbmcgd2l0aG91dCBhbnkgZGF0YVxuICAgKiBhbmQgaXMgbm93IGNvbnNpZGVyZWQgdG8gYmUgZGlzY29ubmVjdGVkLiAgU3RhcnQgc2NoZWR1bGluZyB0ZXN0cyB0byBzZWUgd2hlbiB3ZSBhcmUgYmFjayBvbmxpbmUuXG4gICAqXG4gICAqIEBtZXRob2QgX29ubGluZUV4cGlyZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9vbmxpbmVFeHBpcmVkKCkge1xuICAgIHRoaXMuX2NsZWFyQ2hlY2soKTtcbiAgICB0aGlzLl9jaGFuZ2VUb09mZmxpbmUoKTtcbiAgICB0aGlzLl9zY2hlZHVsZU5leHRPbmxpbmVDaGVjaygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIG5vbmNlIHRvIHNlZSBpZiB3ZSBjYW4gcmVhY2ggdGhlIHNlcnZlci5cbiAgICpcbiAgICogV2UgZG9uJ3QgY2FyZSBhYm91dCB0aGUgcmVzdWx0LFxuICAgKiB3ZSBqdXN0IGNhcmUgYWJvdXQgdHJpZ2dlcmluZyBhICdjb25uZWN0aW9uOnN1Y2Nlc3MnIG9yICdjb25uZWN0aW9uOmVycm9yJyBldmVudFxuICAgKiB3aGljaCBjb25uZWN0aW9uTGlzdGVuZXIgd2lsbCByZXNwb25kIHRvLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbmxpbmVNYW5hZ2VyLmNoZWNrT25saW5lU3RhdHVzKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgKiAgICAgICAgICBhbGVydChyZXN1bHQgPyAnV2UncmUgb25saW5lIScgOiAnRG9oIScpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIGNoZWNrT25saW5lU3RhdHVzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2FsbGJhY2suaXNPbmxpbmUgLSBDYWxsYmFjayBpcyBjYWxsZWQgd2l0aCB0cnVlIGlmIG9ubGluZSwgZmFsc2UgaWYgbm90XG4gICAqL1xuICBjaGVja09ubGluZVN0YXR1cyhjYWxsYmFjaykge1xuICAgIHRoaXMuX2NsZWFyQ2hlY2soKTtcblxuICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IEZpcmluZyBYSFIgZm9yIG9ubGluZSBjaGVjaycpO1xuICAgIHRoaXMuX2xhc3RDaGVja09ubGluZVN0YXR1cyA9IG5ldyBEYXRlKCk7XG4gICAgLy8gUGluZyB0aGUgc2VydmVyIGFuZCBzZWUgaWYgd2UncmUgY29ubmVjdGVkLlxuICAgIHhocih7XG4gICAgICB1cmw6IHRoaXMudGVzdFVybCxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBhY2NlcHQ6IEFDQ0VQVCxcbiAgICAgIH0sXG4gICAgfSwgKCkgPT4ge1xuICAgICAgLy8gdGhpcy5pc09ubGluZSB3aWxsIGJlIHVwZGF0ZWQgdmlhIF9jb25uZWN0aW9uTGlzdGVuZXIgcHJpb3IgdG8gdGhpcyBsaW5lIGV4ZWN1dGluZ1xuICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayh0aGlzLmlzT25saW5lKTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIE9uIGRldGVybWluaW5nIHRoYXQgd2UgYXJlIG9mZmxpbmUsIGhhbmRsZXMgdGhlIHN0YXRlIHRyYW5zaXRpb24gYW5kIGxvZ2dpbmcuXG4gICAqXG4gICAqIEBtZXRob2QgX2NoYW5nZVRvT2ZmbGluZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NoYW5nZVRvT2ZmbGluZSgpIHtcbiAgICBpZiAodGhpcy5pc09ubGluZSkge1xuICAgICAgdGhpcy5pc09ubGluZSA9IGZhbHNlO1xuICAgICAgdGhpcy50cmlnZ2VyKCdkaXNjb25uZWN0ZWQnKTtcbiAgICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IENvbm5lY3Rpb24gbG9zdCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgd2hlbmV2ZXIgYSB3ZWJzb2NrZXQgZXZlbnQgYXJyaXZlcywgb3IgYW4geGhyIGNhbGwgY29tcGxldGVzOyB1cGRhdGVzIG91ciBpc09ubGluZSBzdGF0ZS5cbiAgICpcbiAgICogQW55IGNhbGwgdG8gdGhpcyBtZXRob2Qgd2lsbCByZXNjaGVkdWxlIG91ciBuZXh0IGlzLW9ubGluZSB0ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25MaXN0ZW5lclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGV2dCAtIE5hbWUgb2YgdGhlIGV2ZW50OyBlaXRoZXIgJ2Nvbm5lY3Rpb246c3VjY2Vzcycgb3IgJ2Nvbm5lY3Rpb246ZXJyb3InXG4gICAqL1xuICBfY29ubmVjdGlvbkxpc3RlbmVyKGV2dCkge1xuICAgIC8vIElmIGV2ZW50IGlzIGEgc3VjY2VzcywgY2hhbmdlIHVzIHRvIG9ubGluZVxuICAgIGlmIChldnQuc3RhdHVzID09PSAnY29ubmVjdGlvbjpzdWNjZXNzJykge1xuICAgICAgY29uc3QgbGFzdFRpbWUgPSB0aGlzLmxhc3RNZXNzYWdlVGltZTtcbiAgICAgIHRoaXMubGFzdE1lc3NhZ2VUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgIGlmICghdGhpcy5pc09ubGluZSkge1xuICAgICAgICB0aGlzLmlzT25saW5lID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5vZmZsaW5lQ291bnRlciA9IDA7XG4gICAgICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkJywgeyBvZmZsaW5lRHVyYXRpb246IGxhc3RUaW1lID8gRGF0ZS5ub3coKSAtIGxhc3RUaW1lIDogMCB9KTtcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGVkQ291bnRlciA9PT0gdW5kZWZpbmVkKSB0aGlzLmNvbm5lY3RlZENvdW50ZXIgPSAwO1xuICAgICAgICB0aGlzLmNvbm5lY3RlZENvdW50ZXIrKztcbiAgICAgICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogQ29ubmVjdGVkIHJlc3RvcmVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgZXZlbnQgaXMgTk9UIHN1Y2Nlc3MsIGNoYW5nZSB1cyB0byBvZmZsaW5lLlxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5fY2hhbmdlVG9PZmZsaW5lKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2NoZWR1bGVOZXh0T25saW5lQ2hlY2soKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbnVwL3NodXRkb3duXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cbn1cblxuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5pc0NsaWVudFJlYWR5ID0gZmFsc2U7XG5cbi8qKlxuICogVVJMIFRvIGZpcmUgd2hlbiB0ZXN0aW5nIHRvIHNlZSBpZiB3ZSBhcmUgb25saW5lLlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS50ZXN0VXJsID0gJyc7XG5cbi8qKlxuICogQSBXZWJzb2NrZXQgbWFuYWdlciB3aG9zZSAnbWVzc2FnZScgZXZlbnQgd2Ugd2lsbCBsaXN0ZW4gdG9cbiAqIGluIG9yZGVyIHRvIGtub3cgdGhhdCB3ZSBhcmUgc3RpbGwgb25saW5lLlxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBOdW1iZXIgb2YgdGVzdFVybCByZXF1ZXN0cyB3ZSd2ZSBiZWVuIG9mZmxpbmUgZm9yLlxuICpcbiAqIFdpbGwgc3RvcCBncm93aW5nIG9uY2UgdGhlIG51bWJlciBpcyBzdWl0YWJseSBsYXJnZSAoMTAtMjApLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5vZmZsaW5lQ291bnRlciA9IDA7XG5cbi8qKlxuICogTWF4aW11bSB3YWl0IGR1cmluZyBleHBvbmVudGlhbCBiYWNrb2ZmIHdoaWxlIG9mZmxpbmUuXG4gKlxuICogV2hpbGUgb2ZmbGluZSwgZXhwb25lbnRpYWwgYmFja29mZiBpcyB1c2VkIHRvIGNhbGN1bGF0ZSBob3cgbG9uZyB0byB3YWl0IGJldHdlZW4gY2hlY2tpbmcgd2l0aCB0aGUgc2VydmVyXG4gKiB0byBzZWUgaWYgd2UgYXJlIG9ubGluZSBhZ2Fpbi4gVGhpcyB2YWx1ZSBkZXRlcm1pbmVzIHRoZSBtYXhpbXVtIHdhaXQ7IGFueSBoaWdoZXIgdmFsdWUgcmV0dXJuZWQgYnkgZXhwb25lbnRpYWwgYmFja29mZlxuICogYXJlIGlnbm9yZWQgYW5kIHRoaXMgdmFsdWUgdXNlZCBpbnN0ZWFkLlxuICogVmFsdWUgaXMgbWVhc3VyZWQgaW4gc2Vjb25kcy5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUubWF4T2ZmbGluZVdhaXQgPSA1ICogNjA7XG5cbi8qKlxuICogTWluaW11bSB3YWl0IGJldHdlZW4gdHJpZXMgaW4gbXMuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLm1pbkJhY2tvZmZXYWl0ID0gMTAwO1xuXG4vKipcbiAqIFRpbWUgdGhhdCB0aGUgbGFzdCBzdWNjZXNzZnVsIG1lc3NhZ2Ugd2FzIG9ic2VydmVkLlxuICogQHR5cGUge0RhdGV9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUubGFzdE1lc3NhZ2VUaW1lID0gbnVsbDtcblxuLyoqXG4gKiBGb3IgZGVidWdnaW5nLCB0cmFja3MgdGhlIGxhc3QgdGltZSB3ZSBjaGVja2VkIGlmIHdlIGFyZSBvbmxpbmUuXG4gKiBAdHlwZSB7RGF0ZX1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5fbGFzdENoZWNrT25saW5lU3RhdHVzID0gbnVsbDtcblxuLyoqXG4gKiBBcmUgd2UgY3VycmVudGx5IG9ubGluZT9cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLmlzT25saW5lID0gZmFsc2U7XG5cbi8qKlxuICogc2V0VGltZW91dElkIGZvciB0aGUgbmV4dCBjaGVja09ubGluZVN0YXR1cygpIGNhbGwuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLm9ubGluZUNoZWNrSWQgPSAwO1xuXG4vKipcbiAqIElmIHdlIGFyZSBvbmxpbmUsIGhvdyBvZnRlbiBkbyB3ZSBuZWVkIHRvIHBpbmcgdG8gdmVyaWZ5IHdlIGFyZSBzdGlsbCBvbmxpbmUuXG4gKlxuICogVmFsdWUgaXMgcmVzZXQgYW55IHRpbWUgd2Ugb2JzZXJ2ZSBhbnkgbWVzc2FnZXMgZnJvbSB0aGUgc2VydmVyLlxuICogTWVhc3VyZWQgaW4gbWlsaXNlY29uZHMuIE5PVEU6IFdlYnNvY2tldCBoYXMgYSBzZXBhcmF0ZSBwaW5nIHdoaWNoIG1vc3RseSBtYWtlc1xuICogdGhpcyBvbmUgdW5uZWNlc3NhcnkuICBNYXkgZW5kIHVwIHJlbW92aW5nIHRoaXMgb25lLi4uIHRob3VnaCB3ZSdkIGtlZXAgdGhlXG4gKiBwaW5nIGZvciB3aGVuIG91ciBzdGF0ZSBpcyBvZmZsaW5lLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5waW5nRnJlcXVlbmN5ID0gMTAwICogMTAwMDtcblxuT25saW5lU3RhdGVNYW5hZ2VyLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBXZSBhcHBlYXIgdG8gYmUgb25saW5lIGFuZCBhYmxlIHRvIHNlbmQgYW5kIHJlY2VpdmVcbiAgICogQGV2ZW50IGNvbm5lY3RlZFxuICAgKiBAcGFyYW0ge251bWJlcn0gb25saW5lRHVyYXRpb24gLSBOdW1iZXIgb2YgbWlsaXNlY29uZHMgc2luY2Ugd2Ugd2VyZSBsYXN0IGtub3duIHRvIGJlIG9ubGluZVxuICAgKi9cbiAgJ2Nvbm5lY3RlZCcsXG5cbiAgLyoqXG4gICAqIFdlIGFwcGVhciB0byBiZSBvZmZsaW5lIGFuZCB1bmFibGUgdG8gc2VuZCBvciByZWNlaXZlXG4gICAqIEBldmVudCBkaXNjb25uZWN0ZWRcbiAgICovXG4gICdkaXNjb25uZWN0ZWQnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KE9ubGluZVN0YXRlTWFuYWdlciwgW09ubGluZVN0YXRlTWFuYWdlciwgJ09ubGluZVN0YXRlTWFuYWdlciddKTtcbm1vZHVsZS5leHBvcnRzID0gT25saW5lU3RhdGVNYW5hZ2VyO1xuIl19
