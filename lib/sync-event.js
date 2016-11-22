'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * A Sync Event represents a request to the server.
 * A Sync Event may fire immediately, or may wait in the layer.SyncManager's
 * queue for a long duration before firing.
 *
 * DO NOT confuse this with layer.LayerEvent which represents a change notification
 * to your application.  layer.SyncEvent represents a request to the server that
 * is either in progress or in queue.
 *
 * GET requests are typically NOT done via a SyncEvent as these are typically
 * needed to render a UI and should either fail or succeed promptly.
 *
 * Applications typically do not interact with these objects.
 *
 * @class  layer.SyncEvent
 * @extends layer.Root
 */
var Utils = require('./client-utils');

var SyncEvent = function () {
  /**
   * Create a layer.SyncEvent.  See layer.ClientAuthenticator for examples of usage.
   *
   * @method  constructor
   * @private
   * @return {layer.SyncEvent}
   */
  function SyncEvent(options) {
    _classCallCheck(this, SyncEvent);

    var key = void 0;
    for (key in options) {
      if (key in this) {
        this[key] = options[key];
      }
    }
    if (!this.depends) this.depends = [];
    if (!this.id) this.id = 'layer:///syncevents/' + Utils.generateUUID();
    if (!this.createdAt) this.createdAt = Date.now();
  }

  /**
   * Not strictly required, but nice to clean things up.
   *
   * @method destroy
   */


  _createClass(SyncEvent, [{
    key: 'destroy',
    value: function destroy() {
      this.target = null;
      this.depends = null;
      this.callback = null;
      this.data = null;
    }

    /**
     * Get the Real parameters for the request.
     *
     * @method _updateData
     * @private
     */

  }, {
    key: '_updateData',
    value: function _updateData(client) {
      if (!this.target) return;
      var target = client._getObject(this.target);
      if (target && this.operation === 'POST' && target._getSendData) {
        this.data = target._getSendData(this.data);
      }
    }

    /**
     * Returns a POJO version of this object suitable for serializing for the network
     * @method toObject
     * @returns {Object}
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      return { data: this.data };
    }
  }]);

  return SyncEvent;
}();

/**
 * The type of operation being performed.
 *
 * Either GET, PATCH, DELETE, POST or PUT
 *
 * @property {String}
 */


SyncEvent.prototype.operation = '';

SyncEvent.prototype.fromDB = false;

SyncEvent.prototype.createdAt = 0;

/**
 * Indicates whether this request currently in-flight.
 *
 * * Set to true by _xhr() method,
 * * set to false on completion by layer.SyncManager.
 * * set to false automatically after 2 minutes
 *
 * @property {Boolean}
 */
Object.defineProperty(SyncEvent.prototype, 'isFiring', {
  enumerable: true,
  set: function set(value) {
    this.__isFiring = value;
    if (value) this.__firedAt = Date.now();
  },
  get: function get() {
    return Boolean(this.__isFiring && Date.now() - this.__firedAt < SyncEvent.FIRING_EXPIRATION);
  }
});

/**
 * Indicates whether this request currently being validated to insure it wasn't read
 * from IndexedDB and fired by another tab.
 *
 * @property {Boolean}
 */
Object.defineProperty(SyncEvent.prototype, '_isValidating', {
  enumerable: true,
  set: function set(value) {
    this.__isValidating = value;
    if (value) this.__validatedAt = Date.now();
  },
  get: function get() {
    return Boolean(this.__isValidating && Date.now() - this.__validatedAt < SyncEvent.VALIDATION_EXPIRATION);
  }
});

SyncEvent.prototype.id = '';

/**
 * Indicates whether the request completed successfully.
 *
 * Set by layer.SyncManager.
 * @type {Boolean}
 */
SyncEvent.prototype.success = null;

/**
 * Callback to fire on completing this sync event.
 *
 * WARNING: The nature of this callback may change;
 * a persistence layer that persists the SyncManager's queue
 * must have serializable callbacks (object id + method name; not a function)
 * or must accept that callbacks are not always fired.
 * @type {Function}
 */
SyncEvent.prototype.callback = null;

/**
 * Number of retries on this request.
 *
 * Retries are only counted if its a 502 or 503
 * error.  Set and managed by layer.SyncManager.
 * @type {Number}
 */
SyncEvent.prototype.retryCount = 0;

/**
 * The target of the request.
 *
 * Any Component; typically a Conversation or Message.
 * @type {layer.Root}
 */
SyncEvent.prototype.target = null;

/**
 * Components that this request depends upon.
 *
 * A message cannot be sent if its
 * Conversation fails to get created.
 *
 * NOTE: May prove redundant with the target property and needs further review.
 * @type {layer.Root[]}
 */
SyncEvent.prototype.depends = null;

/**
 * Data field of the xhr call; can be an Object or string (including JSON string)
 * @type {Object}
 */
SyncEvent.prototype.data = null;

/**
 * After firing a request, if that firing state fails to clear after this number of miliseconds,
 * consider it to no longer be firing.  Under normal conditions, firing will be set to false explicitly.
 * This check insures that any failure of that process does not leave us stuck with a firing request
 * blocking the queue.
 * @type {number}
 * @static
 */
SyncEvent.FIRING_EXPIRATION = 1000 * 15;

/**
 * After checking the database to see if this event has been claimed by another browser tab,
 * how long to wait before flagging it as failed, in the event of no-response.  Measured in ms.
 * @type {number}
 * @static
 */
SyncEvent.VALIDATION_EXPIRATION = 500;

/**
 * A layer.SyncEvent intended to be fired as an XHR request.
 *
 * @class layer.SyncEvent.XHRSyncEvent
 * @extends layer.SyncEvent
 */

var XHRSyncEvent = function (_SyncEvent) {
  _inherits(XHRSyncEvent, _SyncEvent);

  function XHRSyncEvent() {
    _classCallCheck(this, XHRSyncEvent);

    return _possibleConstructorReturn(this, (XHRSyncEvent.__proto__ || Object.getPrototypeOf(XHRSyncEvent)).apply(this, arguments));
  }

  _createClass(XHRSyncEvent, [{
    key: '_getRequestData',


    /**
     * Fire the request associated with this instance.
     *
     * Actually it just returns the parameters needed to make the xhr call:
     *
     *      var xhr = require('./xhr');
     *      xhr(event._getRequestData(client));
     *
     * @method _getRequestData
     * @param {layer.Client} client
     * @protected
     * @returns {Object}
     */
    value: function _getRequestData(client) {
      this._updateUrl(client);
      this._updateData(client);
      return {
        url: this.url,
        method: this.method,
        headers: this.headers,
        data: this.data
      };
    }

    /**
     * Get the Real URL.
     *
     * If the url property is a function, call it to set the actual url.
     * Used when the URL is unknown until a prior SyncEvent has completed.
     *
     * @method _updateUrl
     * @private
     */

  }, {
    key: '_updateUrl',
    value: function _updateUrl(client) {
      if (!this.target) return;
      var target = client._getObject(this.target);
      if (target && !this.url.match(/^http(s)\:\/\//)) {
        this.url = target._getUrl(this.url);
      }
    }
  }, {
    key: 'toObject',
    value: function toObject() {
      return {
        data: this.data,
        url: this.url,
        method: this.method
      };
    }
  }, {
    key: '_getCreateId',
    value: function _getCreateId() {
      return this.operation === 'POST' && this.data ? this.data.id : '';
    }
  }]);

  return XHRSyncEvent;
}(SyncEvent);

/**
 * How long before the request times out?
 * @type {Number} [timeout=15000]
 */


XHRSyncEvent.prototype.timeout = 15000;

/**
 * URL to send the request to
 */
XHRSyncEvent.prototype.url = '';

/**
 * Counts number of online state changes.
 *
 * If this number becomes high in a short time period, its probably
 * failing due to a CORS error.
 */
XHRSyncEvent.prototype.returnToOnlineCount = 0;

/**
 * Headers for the request
 */
XHRSyncEvent.prototype.headers = null;

/**
 * Request method.
 */
XHRSyncEvent.prototype.method = 'GET';

/**
 * A layer.SyncEvent intended to be fired as a websocket request.
 *
 * @class layer.SyncEvent.WebsocketSyncEvent
 * @extends layer.SyncEvent
 */

var WebsocketSyncEvent = function (_SyncEvent2) {
  _inherits(WebsocketSyncEvent, _SyncEvent2);

  function WebsocketSyncEvent() {
    _classCallCheck(this, WebsocketSyncEvent);

    return _possibleConstructorReturn(this, (WebsocketSyncEvent.__proto__ || Object.getPrototypeOf(WebsocketSyncEvent)).apply(this, arguments));
  }

  _createClass(WebsocketSyncEvent, [{
    key: '_getRequestData',


    /**
     * Get the websocket request object.
     *
     * @method _getRequestData
     * @private
     * @param {layer.Client} client
     * @return {Object}
     */
    value: function _getRequestData(client) {
      this._updateData(client);
      return this.data;
    }
  }, {
    key: 'toObject',
    value: function toObject() {
      return this.data;
    }
  }, {
    key: '_getCreateId',
    value: function _getCreateId() {
      return this.operation === 'POST' && this.data.data ? this.data.data.id : '';
    }
  }]);

  return WebsocketSyncEvent;
}(SyncEvent);

module.exports = { SyncEvent: SyncEvent, XHRSyncEvent: XHRSyncEvent, WebsocketSyncEvent: WebsocketSyncEvent };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jLWV2ZW50LmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsIlN5bmNFdmVudCIsIm9wdGlvbnMiLCJrZXkiLCJkZXBlbmRzIiwiaWQiLCJnZW5lcmF0ZVVVSUQiLCJjcmVhdGVkQXQiLCJEYXRlIiwibm93IiwidGFyZ2V0IiwiY2FsbGJhY2siLCJkYXRhIiwiY2xpZW50IiwiX2dldE9iamVjdCIsIm9wZXJhdGlvbiIsIl9nZXRTZW5kRGF0YSIsInByb3RvdHlwZSIsImZyb21EQiIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSIsInNldCIsInZhbHVlIiwiX19pc0ZpcmluZyIsIl9fZmlyZWRBdCIsImdldCIsIkJvb2xlYW4iLCJGSVJJTkdfRVhQSVJBVElPTiIsIl9faXNWYWxpZGF0aW5nIiwiX192YWxpZGF0ZWRBdCIsIlZBTElEQVRJT05fRVhQSVJBVElPTiIsInN1Y2Nlc3MiLCJyZXRyeUNvdW50IiwiWEhSU3luY0V2ZW50IiwiX3VwZGF0ZVVybCIsIl91cGRhdGVEYXRhIiwidXJsIiwibWV0aG9kIiwiaGVhZGVycyIsIm1hdGNoIiwiX2dldFVybCIsInRpbWVvdXQiLCJyZXR1cm5Ub09ubGluZUNvdW50IiwiV2Vic29ja2V0U3luY0V2ZW50IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSxJQUFNQSxRQUFRQyxRQUFRLGdCQUFSLENBQWQ7O0lBQ01DLFM7QUFDSjs7Ozs7OztBQU9BLHFCQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLFFBQUlDLFlBQUo7QUFDQSxTQUFLQSxHQUFMLElBQVlELE9BQVosRUFBcUI7QUFDbkIsVUFBSUMsT0FBTyxJQUFYLEVBQWlCO0FBQ2YsYUFBS0EsR0FBTCxJQUFZRCxRQUFRQyxHQUFSLENBQVo7QUFDRDtBQUNGO0FBQ0QsUUFBSSxDQUFDLEtBQUtDLE9BQVYsRUFBbUIsS0FBS0EsT0FB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Qzs7QUFFQTs7O0FBR0FSLGFBQWFqQixTQUFiLENBQXVCb0IsR0FBdkIsR0FBNkIsRUFBN0I7O0FBRUE7Ozs7OztBQU1BSCxhQUFhakIsU0FBYixDQUF1QjBCLG1CQUF2QixHQUE2QyxDQUE3Qzs7QUFFQTs7O0FBR0FULGFBQWFqQixTQUFiLENBQXVCc0IsT0FBdkIsR0FBaUMsSUFBakM7O0FBRUE7OztBQUdBTCxhQUFhakIsU0FBYixDQUF1QnFCLE1BQXZCLEdBQWdDLEtBQWhDOztBQUdBOzs7Ozs7O0lBTU1NLGtCOzs7Ozs7Ozs7Ozs7O0FBRUo7Ozs7Ozs7O29DQVFnQi9CLE0sRUFBUTtBQUN0QixXQUFLdUIsV0FBTCxDQUFpQnZCLE1BQWpCO0FBQ0EsYUFBTyxLQUFLRCxJQUFaO0FBQ0Q7OzsrQkFFVTtBQUNULGFBQU8sS0FBS0EsSUFBWjtBQUNEOzs7bUNBRWM7QUFDYixhQUFPLEtBQUtHLFNBQUwsS0FBbUIsTUFBbkIsSUFBNkIsS0FBS0gsSUFBTCxDQUFVQSxJQUF2QyxHQUE4QyxLQUFLQSxJQUFMLENBQVVBLElBQVYsQ0FBZVAsRUFBN0QsR0FBa0UsRUFBekU7QUFDRDs7OztFQXJCOEJKLFM7O0FBd0JqQzRDLE9BQU9DLE9BQVAsR0FBaUIsRUFBRTdDLG9CQUFGLEVBQWFpQywwQkFBYixFQUEyQlUsc0NBQTNCLEVBQWpCIiwiZmlsZSI6InN5bmMtZXZlbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEEgU3luYyBFdmVudCByZXByZXNlbnRzIGEgcmVxdWVzdCB0byB0aGUgc2VydmVyLlxuICogQSBTeW5jIEV2ZW50IG1heSBmaXJlIGltbWVkaWF0ZWx5LCBvciBtYXkgd2FpdCBpbiB0aGUgbGF5ZXIuU3luY01hbmFnZXInc1xuICogcXVldWUgZm9yIGEgbG9uZyBkdXJhdGlvbiBiZWZvcmUgZmlyaW5nLlxuICpcbiAqIERPIE5PVCBjb25mdXNlIHRoaXMgd2l0aCBsYXllci5MYXllckV2ZW50IHdoaWNoIHJlcHJlc2VudHMgYSBjaGFuZ2Ugbm90aWZpY2F0aW9uXG4gKiB0byB5b3VyIGFwcGxpY2F0aW9uLiAgbGF5ZXIuU3luY0V2ZW50IHJlcHJlc2VudHMgYSByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgdGhhdFxuICogaXMgZWl0aGVyIGluIHByb2dyZXNzIG9yIGluIHF1ZXVlLlxuICpcbiAqIEdFVCByZXF1ZXN0cyBhcmUgdHlwaWNhbGx5IE5PVCBkb25lIHZpYSBhIFN5bmNFdmVudCBhcyB0aGVzZSBhcmUgdHlwaWNhbGx5XG4gKiBuZWVkZWQgdG8gcmVuZGVyIGEgVUkgYW5kIHNob3VsZCBlaXRoZXIgZmFpbCBvciBzdWNjZWVkIHByb21wdGx5LlxuICpcbiAqIEFwcGxpY2F0aW9ucyB0eXBpY2FsbHkgZG8gbm90IGludGVyYWN0IHdpdGggdGhlc2Ugb2JqZWN0cy5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLlN5bmNFdmVudFxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICovXG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jbGFzcyBTeW5jRXZlbnQge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbGF5ZXIuU3luY0V2ZW50LiAgU2VlIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3IgZm9yIGV4YW1wbGVzIG9mIHVzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kICBjb25zdHJ1Y3RvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5TeW5jRXZlbnR9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgbGV0IGtleTtcbiAgICBmb3IgKGtleSBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAoa2V5IGluIHRoaXMpIHtcbiAgICAgICAgdGhpc1trZXldID0gb3B0aW9uc1trZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRoaXMuZGVwZW5kcykgdGhpcy5kZXBlbmRzID0gW107XG4gICAgaWYgKCF0aGlzLmlkKSB0aGlzLmlkID0gJ2xheWVyOi8vL3N5bmNldmVudHMvJyArIFV0aWxzLmdlbmVyYXRlVVVJRCgpO1xuICAgIGlmICghdGhpcy5jcmVhdGVkQXQpIHRoaXMuY3JlYXRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3Qgc3RyaWN0bHkgcmVxdWlyZWQsIGJ1dCBuaWNlIHRvIGNsZWFuIHRoaW5ncyB1cC5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLmRlcGVuZHMgPSBudWxsO1xuICAgIHRoaXMuY2FsbGJhY2sgPSBudWxsO1xuICAgIHRoaXMuZGF0YSA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBSZWFsIHBhcmFtZXRlcnMgZm9yIHRoZSByZXF1ZXN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVEYXRhXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdXBkYXRlRGF0YShjbGllbnQpIHtcbiAgICBpZiAoIXRoaXMudGFyZ2V0KSByZXR1cm47XG4gICAgY29uc3QgdGFyZ2V0ID0gY2xpZW50Ll9nZXRPYmplY3QodGhpcy50YXJnZXQpO1xuICAgIGlmICh0YXJnZXQgJiYgdGhpcy5vcGVyYXRpb24gPT09ICdQT1NUJyAmJiB0YXJnZXQuX2dldFNlbmREYXRhKSB7XG4gICAgICB0aGlzLmRhdGEgPSB0YXJnZXQuX2dldFNlbmREYXRhKHRoaXMuZGF0YSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBQT0pPIHZlcnNpb24gb2YgdGhpcyBvYmplY3Qgc3VpdGFibGUgZm9yIHNlcmlhbGl6aW5nIGZvciB0aGUgbmV0d29ya1xuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAqL1xuICB0b09iamVjdCgpIHtcbiAgICByZXR1cm4geyBkYXRhOiB0aGlzLmRhdGEgfTtcbiAgfVxufVxuXG5cbi8qKlxuICogVGhlIHR5cGUgb2Ygb3BlcmF0aW9uIGJlaW5nIHBlcmZvcm1lZC5cbiAqXG4gKiBFaXRoZXIgR0VULCBQQVRDSCwgREVMRVRFLCBQT1NUIG9yIFBVVFxuICpcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfVxuICovXG5TeW5jRXZlbnQucHJvdG90eXBlLm9wZXJhdGlvbiA9ICcnO1xuXG5TeW5jRXZlbnQucHJvdG90eXBlLmZyb21EQiA9IGZhbHNlO1xuXG5TeW5jRXZlbnQucHJvdG90eXBlLmNyZWF0ZWRBdCA9IDA7XG5cblxuLyoqXG4gKiBJbmRpY2F0ZXMgd2hldGhlciB0aGlzIHJlcXVlc3QgY3VycmVudGx5IGluLWZsaWdodC5cbiAqXG4gKiAqIFNldCB0byB0cnVlIGJ5IF94aHIoKSBtZXRob2QsXG4gKiAqIHNldCB0byBmYWxzZSBvbiBjb21wbGV0aW9uIGJ5IGxheWVyLlN5bmNNYW5hZ2VyLlxuICogKiBzZXQgdG8gZmFsc2UgYXV0b21hdGljYWxseSBhZnRlciAyIG1pbnV0ZXNcbiAqXG4gKiBAcHJvcGVydHkge0Jvb2xlYW59XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTeW5jRXZlbnQucHJvdG90eXBlLCAnaXNGaXJpbmcnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIHNldDogZnVuY3Rpb24gc2V0KHZhbHVlKSB7XG4gICAgdGhpcy5fX2lzRmlyaW5nID0gdmFsdWU7XG4gICAgaWYgKHZhbHVlKSB0aGlzLl9fZmlyZWRBdCA9IERhdGUubm93KCk7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiBCb29sZWFuKHRoaXMuX19pc0ZpcmluZyAmJiBEYXRlLm5vdygpIC0gdGhpcy5fX2ZpcmVkQXQgPCBTeW5jRXZlbnQuRklSSU5HX0VYUElSQVRJT04pO1xuICB9LFxufSk7XG5cbi8qKlxuICogSW5kaWNhdGVzIHdoZXRoZXIgdGhpcyByZXF1ZXN0IGN1cnJlbnRseSBiZWluZyB2YWxpZGF0ZWQgdG8gaW5zdXJlIGl0IHdhc24ndCByZWFkXG4gKiBmcm9tIEluZGV4ZWREQiBhbmQgZmlyZWQgYnkgYW5vdGhlciB0YWIuXG4gKlxuICogQHByb3BlcnR5IHtCb29sZWFufVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU3luY0V2ZW50LnByb3RvdHlwZSwgJ19pc1ZhbGlkYXRpbmcnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIHNldDogZnVuY3Rpb24gc2V0KHZhbHVlKSB7XG4gICAgdGhpcy5fX2lzVmFsaWRhdGluZyA9IHZhbHVlO1xuICAgIGlmICh2YWx1ZSkgdGhpcy5fX3ZhbGlkYXRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIEJvb2xlYW4odGhpcy5fX2lzVmFsaWRhdGluZyAmJiBEYXRlLm5vdygpIC0gdGhpcy5fX3ZhbGlkYXRlZEF0IDwgU3luY0V2ZW50LlZBTElEQVRJT05fRVhQSVJBVElPTik7XG4gIH0sXG59KTtcblxuU3luY0V2ZW50LnByb3RvdHlwZS5pZCA9ICcnO1xuXG5cbi8qKlxuICogSW5kaWNhdGVzIHdoZXRoZXIgdGhlIHJlcXVlc3QgY29tcGxldGVkIHN1Y2Nlc3NmdWxseS5cbiAqXG4gKiBTZXQgYnkgbGF5ZXIuU3luY01hbmFnZXIuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuU3luY0V2ZW50LnByb3RvdHlwZS5zdWNjZXNzID0gbnVsbDtcblxuXG4vKipcbiAqIENhbGxiYWNrIHRvIGZpcmUgb24gY29tcGxldGluZyB0aGlzIHN5bmMgZXZlbnQuXG4gKlxuICogV0FSTklORzogVGhlIG5hdHVyZSBvZiB0aGlzIGNhbGxiYWNrIG1heSBjaGFuZ2U7XG4gKiBhIHBlcnNpc3RlbmNlIGxheWVyIHRoYXQgcGVyc2lzdHMgdGhlIFN5bmNNYW5hZ2VyJ3MgcXVldWVcbiAqIG11c3QgaGF2ZSBzZXJpYWxpemFibGUgY2FsbGJhY2tzIChvYmplY3QgaWQgKyBtZXRob2QgbmFtZTsgbm90IGEgZnVuY3Rpb24pXG4gKiBvciBtdXN0IGFjY2VwdCB0aGF0IGNhbGxiYWNrcyBhcmUgbm90IGFsd2F5cyBmaXJlZC5cbiAqIEB0eXBlIHtGdW5jdGlvbn1cbiAqL1xuU3luY0V2ZW50LnByb3RvdHlwZS5jYWxsYmFjayA9IG51bGw7XG5cbi8qKlxuICogTnVtYmVyIG9mIHJldHJpZXMgb24gdGhpcyByZXF1ZXN0LlxuICpcbiAqIFJldHJpZXMgYXJlIG9ubHkgY291bnRlZCBpZiBpdHMgYSA1MDIgb3IgNTAzXG4gKiBlcnJvci4gIFNldCBhbmQgbWFuYWdlZCBieSBsYXllci5TeW5jTWFuYWdlci5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblN5bmNFdmVudC5wcm90b3R5cGUucmV0cnlDb3VudCA9IDA7XG5cbi8qKlxuICogVGhlIHRhcmdldCBvZiB0aGUgcmVxdWVzdC5cbiAqXG4gKiBBbnkgQ29tcG9uZW50OyB0eXBpY2FsbHkgYSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZS5cbiAqIEB0eXBlIHtsYXllci5Sb290fVxuICovXG5TeW5jRXZlbnQucHJvdG90eXBlLnRhcmdldCA9IG51bGw7XG5cbi8qKlxuICogQ29tcG9uZW50cyB0aGF0IHRoaXMgcmVxdWVzdCBkZXBlbmRzIHVwb24uXG4gKlxuICogQSBtZXNzYWdlIGNhbm5vdCBiZSBzZW50IGlmIGl0c1xuICogQ29udmVyc2F0aW9uIGZhaWxzIHRvIGdldCBjcmVhdGVkLlxuICpcbiAqIE5PVEU6IE1heSBwcm92ZSByZWR1bmRhbnQgd2l0aCB0aGUgdGFyZ2V0IHByb3BlcnR5IGFuZCBuZWVkcyBmdXJ0aGVyIHJldmlldy5cbiAqIEB0eXBlIHtsYXllci5Sb290W119XG4gKi9cblN5bmNFdmVudC5wcm90b3R5cGUuZGVwZW5kcyA9IG51bGw7XG5cbi8qKlxuICogRGF0YSBmaWVsZCBvZiB0aGUgeGhyIGNhbGw7IGNhbiBiZSBhbiBPYmplY3Qgb3Igc3RyaW5nIChpbmNsdWRpbmcgSlNPTiBzdHJpbmcpXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5TeW5jRXZlbnQucHJvdG90eXBlLmRhdGEgPSBudWxsO1xuXG4vKipcbiAqIEFmdGVyIGZpcmluZyBhIHJlcXVlc3QsIGlmIHRoYXQgZmlyaW5nIHN0YXRlIGZhaWxzIHRvIGNsZWFyIGFmdGVyIHRoaXMgbnVtYmVyIG9mIG1pbGlzZWNvbmRzLFxuICogY29uc2lkZXIgaXQgdG8gbm8gbG9uZ2VyIGJlIGZpcmluZy4gIFVuZGVyIG5vcm1hbCBjb25kaXRpb25zLCBmaXJpbmcgd2lsbCBiZSBzZXQgdG8gZmFsc2UgZXhwbGljaXRseS5cbiAqIFRoaXMgY2hlY2sgaW5zdXJlcyB0aGF0IGFueSBmYWlsdXJlIG9mIHRoYXQgcHJvY2VzcyBkb2VzIG5vdCBsZWF2ZSB1cyBzdHVjayB3aXRoIGEgZmlyaW5nIHJlcXVlc3RcbiAqIGJsb2NraW5nIHRoZSBxdWV1ZS5cbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNFdmVudC5GSVJJTkdfRVhQSVJBVElPTiA9IDEwMDAgKiAxNTtcblxuLyoqXG4gKiBBZnRlciBjaGVja2luZyB0aGUgZGF0YWJhc2UgdG8gc2VlIGlmIHRoaXMgZXZlbnQgaGFzIGJlZW4gY2xhaW1lZCBieSBhbm90aGVyIGJyb3dzZXIgdGFiLFxuICogaG93IGxvbmcgdG8gd2FpdCBiZWZvcmUgZmxhZ2dpbmcgaXQgYXMgZmFpbGVkLCBpbiB0aGUgZXZlbnQgb2Ygbm8tcmVzcG9uc2UuICBNZWFzdXJlZCBpbiBtcy5cbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNFdmVudC5WQUxJREFUSU9OX0VYUElSQVRJT04gPSA1MDA7XG5cbi8qKlxuICogQSBsYXllci5TeW5jRXZlbnQgaW50ZW5kZWQgdG8gYmUgZmlyZWQgYXMgYW4gWEhSIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzIGxheWVyLlN5bmNFdmVudC5YSFJTeW5jRXZlbnRcbiAqIEBleHRlbmRzIGxheWVyLlN5bmNFdmVudFxuICovXG5jbGFzcyBYSFJTeW5jRXZlbnQgZXh0ZW5kcyBTeW5jRXZlbnQge1xuXG4gIC8qKlxuICAgKiBGaXJlIHRoZSByZXF1ZXN0IGFzc29jaWF0ZWQgd2l0aCB0aGlzIGluc3RhbmNlLlxuICAgKlxuICAgKiBBY3R1YWxseSBpdCBqdXN0IHJldHVybnMgdGhlIHBhcmFtZXRlcnMgbmVlZGVkIHRvIG1ha2UgdGhlIHhociBjYWxsOlxuICAgKlxuICAgKiAgICAgIHZhciB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuICAgKiAgICAgIHhocihldmVudC5fZ2V0UmVxdWVzdERhdGEoY2xpZW50KSk7XG4gICAqXG4gICAqIEBtZXRob2QgX2dldFJlcXVlc3REYXRhXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgKi9cbiAgX2dldFJlcXVlc3REYXRhKGNsaWVudCkge1xuICAgIHRoaXMuX3VwZGF0ZVVybChjbGllbnQpO1xuICAgIHRoaXMuX3VwZGF0ZURhdGEoY2xpZW50KTtcbiAgICByZXR1cm4ge1xuICAgICAgdXJsOiB0aGlzLnVybCxcbiAgICAgIG1ldGhvZDogdGhpcy5tZXRob2QsXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnMsXG4gICAgICBkYXRhOiB0aGlzLmRhdGEsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIFJlYWwgVVJMLlxuICAgKlxuICAgKiBJZiB0aGUgdXJsIHByb3BlcnR5IGlzIGEgZnVuY3Rpb24sIGNhbGwgaXQgdG8gc2V0IHRoZSBhY3R1YWwgdXJsLlxuICAgKiBVc2VkIHdoZW4gdGhlIFVSTCBpcyB1bmtub3duIHVudGlsIGEgcHJpb3IgU3luY0V2ZW50IGhhcyBjb21wbGV0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVVybFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3VwZGF0ZVVybChjbGllbnQpIHtcbiAgICBpZiAoIXRoaXMudGFyZ2V0KSByZXR1cm47XG4gICAgY29uc3QgdGFyZ2V0ID0gY2xpZW50Ll9nZXRPYmplY3QodGhpcy50YXJnZXQpO1xuICAgIGlmICh0YXJnZXQgJiYgIXRoaXMudXJsLm1hdGNoKC9eaHR0cChzKVxcOlxcL1xcLy8pKSB7XG4gICAgICB0aGlzLnVybCA9IHRhcmdldC5fZ2V0VXJsKHRoaXMudXJsKTtcbiAgICB9XG4gIH1cblxuICB0b09iamVjdCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5kYXRhLFxuICAgICAgdXJsOiB0aGlzLnVybCxcbiAgICAgIG1ldGhvZDogdGhpcy5tZXRob2QsXG4gICAgfTtcbiAgfVxuXG4gIF9nZXRDcmVhdGVJZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vcGVyYXRpb24gPT09ICdQT1NUJyAmJiB0aGlzLmRhdGEgPyB0aGlzLmRhdGEuaWQgOiAnJztcbiAgfVxufVxuXG4vKipcbiAqIEhvdyBsb25nIGJlZm9yZSB0aGUgcmVxdWVzdCB0aW1lcyBvdXQ/XG4gKiBAdHlwZSB7TnVtYmVyfSBbdGltZW91dD0xNTAwMF1cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS50aW1lb3V0ID0gMTUwMDA7XG5cbi8qKlxuICogVVJMIHRvIHNlbmQgdGhlIHJlcXVlc3QgdG9cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS51cmwgPSAnJztcblxuLyoqXG4gKiBDb3VudHMgbnVtYmVyIG9mIG9ubGluZSBzdGF0ZSBjaGFuZ2VzLlxuICpcbiAqIElmIHRoaXMgbnVtYmVyIGJlY29tZXMgaGlnaCBpbiBhIHNob3J0IHRpbWUgcGVyaW9kLCBpdHMgcHJvYmFibHlcbiAqIGZhaWxpbmcgZHVlIHRvIGEgQ09SUyBlcnJvci5cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS5yZXR1cm5Ub09ubGluZUNvdW50ID0gMDtcblxuLyoqXG4gKiBIZWFkZXJzIGZvciB0aGUgcmVxdWVzdFxuICovXG5YSFJTeW5jRXZlbnQucHJvdG90eXBlLmhlYWRlcnMgPSBudWxsO1xuXG4vKipcbiAqIFJlcXVlc3QgbWV0aG9kLlxuICovXG5YSFJTeW5jRXZlbnQucHJvdG90eXBlLm1ldGhvZCA9ICdHRVQnO1xuXG5cbi8qKlxuICogQSBsYXllci5TeW5jRXZlbnQgaW50ZW5kZWQgdG8gYmUgZmlyZWQgYXMgYSB3ZWJzb2NrZXQgcmVxdWVzdC5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIuU3luY0V2ZW50LldlYnNvY2tldFN5bmNFdmVudFxuICogQGV4dGVuZHMgbGF5ZXIuU3luY0V2ZW50XG4gKi9cbmNsYXNzIFdlYnNvY2tldFN5bmNFdmVudCBleHRlbmRzIFN5bmNFdmVudCB7XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgd2Vic29ja2V0IHJlcXVlc3Qgb2JqZWN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRSZXF1ZXN0RGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIF9nZXRSZXF1ZXN0RGF0YShjbGllbnQpIHtcbiAgICB0aGlzLl91cGRhdGVEYXRhKGNsaWVudCk7XG4gICAgcmV0dXJuIHRoaXMuZGF0YTtcbiAgfVxuXG4gIHRvT2JqZWN0KCkge1xuICAgIHJldHVybiB0aGlzLmRhdGE7XG4gIH1cblxuICBfZ2V0Q3JlYXRlSWQoKSB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uID09PSAnUE9TVCcgJiYgdGhpcy5kYXRhLmRhdGEgPyB0aGlzLmRhdGEuZGF0YS5pZCA6ICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBTeW5jRXZlbnQsIFhIUlN5bmNFdmVudCwgV2Vic29ja2V0U3luY0V2ZW50IH07XG4iXX0=
