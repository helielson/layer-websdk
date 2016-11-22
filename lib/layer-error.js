'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class represents a Layer Error.
 *
 * At this point, a LayerError is only used in response to an error from the server.
 * It may be extended to report on internal errors... but typically internal errors
 * are reported via `throw new Error(...);`
 *
 * Layer Error is passed as part of the layer.LayerEvent's data property.
 *
 * Throw an error:
 *
 *     object.trigger('xxx-error', new LayerEvent({
 *       data: new LayerError()
 *     }));
 *
 *  Receive an Error:
 *
 *     conversation.on('loaded-error', function(errEvt) {
 *        var error = errEvt.data;
 *        console.error(error.message);
 *     });
 *
 * @class layer.LayerError
 */
var Logger = require('./logger');

var LayerError = function () {
  function LayerError(options) {
    var _this = this;

    _classCallCheck(this, LayerError);

    if (options instanceof LayerError) {
      options = {
        errType: options.errType,
        httpStatus: options.httpStatus,
        message: options.message,
        code: options.code,
        url: options.url,
        data: options.data
      };
    } else if (options && (typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
      options.errType = options.id;
    } else {
      options = {
        message: options
      };
    }

    Object.keys(options).forEach(function (name) {
      return _this[name] = options[name];
    });
    if (!this.data) this.data = {};
  }

  /**
   * Returns either '' or a nonce.
   *
   * If a nonce has been returned
   * by the server as part of a session-expiration error,
   * then this method will return that nonce.
   *
   * @method getNonce
   * @return {string} nonce
   */


  _createClass(LayerError, [{
    key: 'getNonce',
    value: function getNonce() {
      return this.data && this.data.nonce ? this.data.nonce : '';
    }

    /**
     * String representation of the error
     *
     * @method toString
     * @return {string}
     */

  }, {
    key: 'toString',
    value: function toString() {
      return this.code + ' (' + this.id + '): ' + this.message + '; (see ' + this.url + ')';
    }

    /**
     * Log the errors
     *
     * @method log
     * @deprecated see layer.Logger
     */

  }, {
    key: 'log',
    value: function log() {
      Logger.error('Layer-Error: ' + this.toString());
    }
  }]);

  return LayerError;
}();

/**
 * A string name for the event; these names are paired with codes.
 *
 * Codes can be looked up at https://github.com/layerhq/docs/blob/web-api/specs/rest-api.md#client-errors
 * @type {String}
 */


LayerError.prototype.errType = '';

/**
 * Numerical error code.
 *
 * https://developer.layer.com/docs/client/rest#full-list
 * @type {Number}
 */
LayerError.prototype.code = 0;

/**
 * URL to go to for more information on this error.
 * @type {String}
 */
LayerError.prototype.url = '';

/**
 * Detailed description of the error.
 * @type {String}
 */
LayerError.prototype.message = '';

/**
 * Http error code; no value if its a websocket response.
 * @type {Number}
 */
LayerError.prototype.httpStatus = 0;

/**
 * Contains data from the xhr request object.
 *
 *  * url: the url to the service endpoint
 *  * data: xhr.data,
 *  * xhr: XMLHttpRequest object
 *
 * @type {Object}
 */
LayerError.prototype.request = null;

/**
 * Any additional details about the error sent as additional properties.
 * @type {Object}
 */
LayerError.prototype.data = null;

/**
 * Pointer to the xhr object that fired the actual request and contains the response.
 * @type {XMLHttpRequest}
 */
LayerError.prototype.xhr = null;

/**
 * Dictionary of error messages
 * @property {Object} [dictionary={}]
 */
LayerError.dictionary = {
  appIdMissing: 'Property missing: appId is required',
  identityTokenMissing: 'Identity Token missing: answerAuthenticationChallenge requires an identity token',
  sessionTokenMissing: 'Session Token missing: _authComplete requires a {session_token: value} input',
  clientMissing: 'Property missing: client is required',
  conversationMissing: 'Property missing: conversation is required',
  partsMissing: 'Property missing: parts is required',
  moreParticipantsRequired: 'Conversation needs participants other than the current user',
  isDestroyed: 'Object is destroyed',
  urlRequired: 'Object needs a url property',
  invalidUrl: 'URL is invalid',
  invalidId: 'Identifier is invalid',
  idParamRequired: 'The ID Parameter is required',
  wrongClass: 'Parameter class error; should be: ',
  inProgress: 'Operation already in progress',
  cantChangeIfConnected: 'You can not change value after connecting',
  cantChangeUserId: 'You can not change the userId property',
  alreadySent: 'Already sent or sending',
  contentRequired: 'MessagePart requires rich content for this call',
  alreadyDestroyed: 'This object has already been destroyed',
  deletionModeUnsupported: 'Call to deletion was made with an unsupported deletion mode',
  sessionAndUserRequired: 'connectWithSession requires both a userId and a sessionToken',
  invalidUserIdChange: 'The prn field in the Identity Token must match the requested UserID',
  predicateNotSupported: 'The predicate is not supported for this value of model',
  invalidPredicate: 'The predicate does not match the expected format',
  appIdImmutable: 'The appId property cannot be changed',
  clientMustBeReady: 'The Client must have triggered its "ready" event before you can call this'
};

module.exports = LayerError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sYXllci1lcnJvci5qcyJdLCJuYW1lcyI6WyJMb2dnZXIiLCJyZXF1aXJlIiwiTGF5ZXJFcnJvciIsIm9wdGlvbnMiLCJlcnJUeXBlIiwiaHR0cFN0YXR1cyIsIm1lc3NhZ2UiLCJjb2RlIiwidXJsIiwiZGF0YSIsImlkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJuYW1lIiwibm9uY2UiLCJlcnJvciIsInRvU3RyaW5nIiwicHJvdG90eXBlIiwicmVxdWVzdCIsInhociIsImRpY3Rpb25hcnkiLCJhcHBJZE1pc3NpbmciLCJpZGVudGl0eVRva2VuTWlzc2luZyIsInNlc3Npb25Ub2tlbk1pc3NpbmciLCJjbGllbnRNaXNzaW5nIiwiY29udmVyc2F0aW9uTWlzc2luZyIsInBhcnRzTWlzc2luZyIsIm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCIsImlzRGVzdHJveWVkIiwidXJsUmVxdWlyZWQiLCJpbnZhbGlkVXJsIiwiaW52YWxpZElkIiwiaWRQYXJhbVJlcXVpcmVkIiwid3JvbmdDbGFzcyIsImluUHJvZ3Jlc3MiLCJjYW50Q2hhbmdlSWZDb25uZWN0ZWQiLCJjYW50Q2hhbmdlVXNlcklkIiwiYWxyZWFkeVNlbnQiLCJjb250ZW50UmVxdWlyZWQiLCJhbHJlYWR5RGVzdHJveWVkIiwiZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQiLCJzZXNzaW9uQW5kVXNlclJlcXVpcmVkIiwiaW52YWxpZFVzZXJJZENoYW5nZSIsInByZWRpY2F0ZU5vdFN1cHBvcnRlZCIsImludmFsaWRQcmVkaWNhdGUiLCJhcHBJZEltbXV0YWJsZSIsImNsaWVudE11c3RCZVJlYWR5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBd0JBLElBQU1BLFNBQVNDLFFBQVEsVUFBUixDQUFmOztJQUNNQyxVO0FBQ0osc0JBQVlDLE9BQVosRUFBcUI7QUFBQTs7QUFBQTs7QUFDbkIsUUFBSUEsbUJBQW1CRCxVQUF2QixFQUFtQztBQUNqQ0MsZ0JBQVU7QUFDUkMsaUJBQVNELFFBQVFDLE9BRFQ7QUFFUkMsb0JBQVlGLFFBQVFFLFVBRlo7QUFHUkMsaUJBQVNILFFBQVFHLE9BSFQ7QUFJUkMsY0FBTUosUUFBUUksSUFKTjtBQUtSQyxhQUFLTCxRQUFRSyxHQUxMO0FBTVJDLGNBQU1OLFFBQVFNO0FBTk4sT0FBVjtBQVFELEtBVEQsTUFTTyxJQUFJTixXQUFXLFFBQU9BLE9BQVAseUNBQU9BLE9BQVAsT0FBbUIsUUFBbEMsRUFBNEM7QUFDakRBLGNBQVFDLE9BQVIsR0FBa0JELFFBQVFPLEVBQTFCO0FBQ0QsS0FGTSxNQUVBO0FBQ0xQLGdCQUFVO0FBQ1JHLGlCQUFTSDtBQURELE9BQVY7QUFHRDs7QUFFRFEsV0FBT0MsSUFBUCxDQUFZVCxPQUFaLEVBQXFCVSxPQUFyQixDQUE2QjtBQUFBLGFBQVEsTUFBS0MsSUFBTCxJQUFhWCxRQUFRVyxJQUFSLENBQXJCO0FBQUEsS0FBN0I7QUFDQSxRQUFJLENBQUMsS0FBS0wsSUFBVixFQUFnQixLQUFLQSxJQUFMLEdBQVksRUFBWjtBQUNqQjs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7K0JBVVc7QUFDVCxhQUFRLEtBQUtBLElBQUwsSUFBYSxLQUFLQSxJQUFMLENBQVVNLEtBQXhCLEdBQWlDLEtBQUtOLElBQUwsQ0FBVU0sS0FBM0MsR0FBbUQsRUFBMUQ7QUFDRDs7QUFFRDs7Ozs7Ozs7OytCQU1XO0FBQ1QsYUFBTyxLQUFLUixJQUFMLEdBQVksSUFBWixHQUFtQixLQUFLRyxFQUF4QixHQUE2QixLQUE3QixHQUFxQyxLQUFLSixPQUExQyxHQUFvRCxTQUFwRCxHQUFnRSxLQUFLRSxHQUFyRSxHQUEyRSxHQUFsRjtBQUNEOztBQUVEOzs7Ozs7Ozs7MEJBTU07QUFDSlIsYUFBT2dCLEtBQVAsQ0FBYSxrQkFBa0IsS0FBS0MsUUFBTCxFQUEvQjtBQUNEOzs7Ozs7QUFJSDs7Ozs7Ozs7QUFNQWYsV0FBV2dCLFNBQVgsQ0FBcUJkLE9BQXJCLEdBQStCLEVBQS9COztBQUVBOzs7Ozs7QUFNQUYsV0FBV2dCLFNBQVgsQ0FBcUJYLElBQXJCLEdBQTRCLENBQTVCOztBQUVBOzs7O0FBSUFMLFdBQVdnQixTQUFYLENBQXFCVixHQUFyQixHQUEyQixFQUEzQjs7QUFFQTs7OztBQUlBTixXQUFXZ0IsU0FBWCxDQUFxQlosT0FBckIsR0FBK0IsRUFBL0I7O0FBRUE7Ozs7QUFJQUosV0FBV2dCLFNBQVgsQ0FBcUJiLFVBQXJCLEdBQWtDLENBQWxDOztBQUVBOzs7Ozs7Ozs7QUFTQUgsV0FBV2dCLFNBQVgsQ0FBcUJDLE9BQXJCLEdBQStCLElBQS9COztBQUVBOzs7O0FBSUFqQixXQUFXZ0IsU0FBWCxDQUFxQlQsSUFBckIsR0FBNEIsSUFBNUI7O0FBRUE7Ozs7QUFJQVAsV0FBV2dCLFNBQVgsQ0FBcUJFLEdBQXJCLEdBQTJCLElBQTNCOztBQUVBOzs7O0FBSUFsQixXQUFXbUIsVUFBWCxHQUF3QjtBQUN0QkMsZ0JBQWMscUNBRFE7QUFFdEJDLHdCQUFzQixrRkFGQTtBQUd0QkMsdUJBQXFCLDhFQUhDO0FBSXRCQyxpQkFBZSxzQ0FKTztBQUt0QkMsdUJBQXFCLDRDQUxDO0FBTXRCQyxnQkFBYyxxQ0FOUTtBQU90QkMsNEJBQTBCLDZEQVBKO0FBUXRCQyxlQUFhLHFCQVJTO0FBU3RCQyxlQUFhLDZCQVRTO0FBVXRCQyxjQUFZLGdCQVZVO0FBV3RCQyxhQUFXLHVCQVhXO0FBWXRCQyxtQkFBaUIsOEJBWks7QUFhdEJDLGNBQVksb0NBYlU7QUFjdEJDLGNBQVksK0JBZFU7QUFldEJDLHlCQUF1QiwyQ0FmRDtBQWdCdEJDLG9CQUFrQix3Q0FoQkk7QUFpQnRCQyxlQUFhLHlCQWpCUztBQWtCdEJDLG1CQUFpQixpREFsQks7QUFtQnRCQyxvQkFBa0Isd0NBbkJJO0FBb0J0QkMsMkJBQXlCLDZEQXBCSDtBQXFCdEJDLDBCQUF3Qiw4REFyQkY7QUFzQnRCQyx1QkFBcUIscUVBdEJDO0FBdUJ0QkMseUJBQXVCLHdEQXZCRDtBQXdCdEJDLG9CQUFrQixrREF4Qkk7QUF5QnRCQyxrQkFBZ0Isc0NBekJNO0FBMEJ0QkMscUJBQW1CO0FBMUJHLENBQXhCOztBQTZCQUMsT0FBT0MsT0FBUCxHQUFpQi9DLFVBQWpCIiwiZmlsZSI6ImxheWVyLWVycm9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBMYXllciBFcnJvci5cbiAqXG4gKiBBdCB0aGlzIHBvaW50LCBhIExheWVyRXJyb3IgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIGFuIGVycm9yIGZyb20gdGhlIHNlcnZlci5cbiAqIEl0IG1heSBiZSBleHRlbmRlZCB0byByZXBvcnQgb24gaW50ZXJuYWwgZXJyb3JzLi4uIGJ1dCB0eXBpY2FsbHkgaW50ZXJuYWwgZXJyb3JzXG4gKiBhcmUgcmVwb3J0ZWQgdmlhIGB0aHJvdyBuZXcgRXJyb3IoLi4uKTtgXG4gKlxuICogTGF5ZXIgRXJyb3IgaXMgcGFzc2VkIGFzIHBhcnQgb2YgdGhlIGxheWVyLkxheWVyRXZlbnQncyBkYXRhIHByb3BlcnR5LlxuICpcbiAqIFRocm93IGFuIGVycm9yOlxuICpcbiAqICAgICBvYmplY3QudHJpZ2dlcigneHh4LWVycm9yJywgbmV3IExheWVyRXZlbnQoe1xuICogICAgICAgZGF0YTogbmV3IExheWVyRXJyb3IoKVxuICogICAgIH0pKTtcbiAqXG4gKiAgUmVjZWl2ZSBhbiBFcnJvcjpcbiAqXG4gKiAgICAgY29udmVyc2F0aW9uLm9uKCdsb2FkZWQtZXJyb3InLCBmdW5jdGlvbihlcnJFdnQpIHtcbiAqICAgICAgICB2YXIgZXJyb3IgPSBlcnJFdnQuZGF0YTtcbiAqICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICogICAgIH0pO1xuICpcbiAqIEBjbGFzcyBsYXllci5MYXllckVycm9yXG4gKi9cbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jbGFzcyBMYXllckVycm9yIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zIGluc3RhbmNlb2YgTGF5ZXJFcnJvcikge1xuICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgZXJyVHlwZTogb3B0aW9ucy5lcnJUeXBlLFxuICAgICAgICBodHRwU3RhdHVzOiBvcHRpb25zLmh0dHBTdGF0dXMsXG4gICAgICAgIG1lc3NhZ2U6IG9wdGlvbnMubWVzc2FnZSxcbiAgICAgICAgY29kZTogb3B0aW9ucy5jb2RlLFxuICAgICAgICB1cmw6IG9wdGlvbnMudXJsLFxuICAgICAgICBkYXRhOiBvcHRpb25zLmRhdGEsXG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG9wdGlvbnMuZXJyVHlwZSA9IG9wdGlvbnMuaWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG9wdGlvbnMsXG4gICAgICB9O1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKG9wdGlvbnMpLmZvckVhY2gobmFtZSA9PiB0aGlzW25hbWVdID0gb3B0aW9uc1tuYW1lXSk7XG4gICAgaWYgKCF0aGlzLmRhdGEpIHRoaXMuZGF0YSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgZWl0aGVyICcnIG9yIGEgbm9uY2UuXG4gICAqXG4gICAqIElmIGEgbm9uY2UgaGFzIGJlZW4gcmV0dXJuZWRcbiAgICogYnkgdGhlIHNlcnZlciBhcyBwYXJ0IG9mIGEgc2Vzc2lvbi1leHBpcmF0aW9uIGVycm9yLFxuICAgKiB0aGVuIHRoaXMgbWV0aG9kIHdpbGwgcmV0dXJuIHRoYXQgbm9uY2UuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Tm9uY2VcbiAgICogQHJldHVybiB7c3RyaW5nfSBub25jZVxuICAgKi9cbiAgZ2V0Tm9uY2UoKSB7XG4gICAgcmV0dXJuICh0aGlzLmRhdGEgJiYgdGhpcy5kYXRhLm5vbmNlKSA/IHRoaXMuZGF0YS5ub25jZSA6ICcnO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCB0b1N0cmluZ1xuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy5jb2RlICsgJyAoJyArIHRoaXMuaWQgKyAnKTogJyArIHRoaXMubWVzc2FnZSArICc7IChzZWUgJyArIHRoaXMudXJsICsgJyknO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZyB0aGUgZXJyb3JzXG4gICAqXG4gICAqIEBtZXRob2QgbG9nXG4gICAqIEBkZXByZWNhdGVkIHNlZSBsYXllci5Mb2dnZXJcbiAgICovXG4gIGxvZygpIHtcbiAgICBMb2dnZXIuZXJyb3IoJ0xheWVyLUVycm9yOiAnICsgdGhpcy50b1N0cmluZygpKTtcbiAgfVxuXG59XG5cbi8qKlxuICogQSBzdHJpbmcgbmFtZSBmb3IgdGhlIGV2ZW50OyB0aGVzZSBuYW1lcyBhcmUgcGFpcmVkIHdpdGggY29kZXMuXG4gKlxuICogQ29kZXMgY2FuIGJlIGxvb2tlZCB1cCBhdCBodHRwczovL2dpdGh1Yi5jb20vbGF5ZXJocS9kb2NzL2Jsb2Ivd2ViLWFwaS9zcGVjcy9yZXN0LWFwaS5tZCNjbGllbnQtZXJyb3JzXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5lcnJUeXBlID0gJyc7XG5cbi8qKlxuICogTnVtZXJpY2FsIGVycm9yIGNvZGUuXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubGF5ZXIuY29tL2RvY3MvY2xpZW50L3Jlc3QjZnVsbC1saXN0XG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5jb2RlID0gMDtcblxuLyoqXG4gKiBVUkwgdG8gZ28gdG8gZm9yIG1vcmUgaW5mb3JtYXRpb24gb24gdGhpcyBlcnJvci5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkxheWVyRXJyb3IucHJvdG90eXBlLnVybCA9ICcnO1xuXG4vKipcbiAqIERldGFpbGVkIGRlc2NyaXB0aW9uIG9mIHRoZSBlcnJvci5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkxheWVyRXJyb3IucHJvdG90eXBlLm1lc3NhZ2UgPSAnJztcblxuLyoqXG4gKiBIdHRwIGVycm9yIGNvZGU7IG5vIHZhbHVlIGlmIGl0cyBhIHdlYnNvY2tldCByZXNwb25zZS5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbkxheWVyRXJyb3IucHJvdG90eXBlLmh0dHBTdGF0dXMgPSAwO1xuXG4vKipcbiAqIENvbnRhaW5zIGRhdGEgZnJvbSB0aGUgeGhyIHJlcXVlc3Qgb2JqZWN0LlxuICpcbiAqICAqIHVybDogdGhlIHVybCB0byB0aGUgc2VydmljZSBlbmRwb2ludFxuICogICogZGF0YTogeGhyLmRhdGEsXG4gKiAgKiB4aHI6IFhNTEh0dHBSZXF1ZXN0IG9iamVjdFxuICpcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbkxheWVyRXJyb3IucHJvdG90eXBlLnJlcXVlc3QgPSBudWxsO1xuXG4vKipcbiAqIEFueSBhZGRpdGlvbmFsIGRldGFpbHMgYWJvdXQgdGhlIGVycm9yIHNlbnQgYXMgYWRkaXRpb25hbCBwcm9wZXJ0aWVzLlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUuZGF0YSA9IG51bGw7XG5cbi8qKlxuICogUG9pbnRlciB0byB0aGUgeGhyIG9iamVjdCB0aGF0IGZpcmVkIHRoZSBhY3R1YWwgcmVxdWVzdCBhbmQgY29udGFpbnMgdGhlIHJlc3BvbnNlLlxuICogQHR5cGUge1hNTEh0dHBSZXF1ZXN0fVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS54aHIgPSBudWxsO1xuXG4vKipcbiAqIERpY3Rpb25hcnkgb2YgZXJyb3IgbWVzc2FnZXNcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBbZGljdGlvbmFyeT17fV1cbiAqL1xuTGF5ZXJFcnJvci5kaWN0aW9uYXJ5ID0ge1xuICBhcHBJZE1pc3Npbmc6ICdQcm9wZXJ0eSBtaXNzaW5nOiBhcHBJZCBpcyByZXF1aXJlZCcsXG4gIGlkZW50aXR5VG9rZW5NaXNzaW5nOiAnSWRlbnRpdHkgVG9rZW4gbWlzc2luZzogYW5zd2VyQXV0aGVudGljYXRpb25DaGFsbGVuZ2UgcmVxdWlyZXMgYW4gaWRlbnRpdHkgdG9rZW4nLFxuICBzZXNzaW9uVG9rZW5NaXNzaW5nOiAnU2Vzc2lvbiBUb2tlbiBtaXNzaW5nOiBfYXV0aENvbXBsZXRlIHJlcXVpcmVzIGEge3Nlc3Npb25fdG9rZW46IHZhbHVlfSBpbnB1dCcsXG4gIGNsaWVudE1pc3Npbmc6ICdQcm9wZXJ0eSBtaXNzaW5nOiBjbGllbnQgaXMgcmVxdWlyZWQnLFxuICBjb252ZXJzYXRpb25NaXNzaW5nOiAnUHJvcGVydHkgbWlzc2luZzogY29udmVyc2F0aW9uIGlzIHJlcXVpcmVkJyxcbiAgcGFydHNNaXNzaW5nOiAnUHJvcGVydHkgbWlzc2luZzogcGFydHMgaXMgcmVxdWlyZWQnLFxuICBtb3JlUGFydGljaXBhbnRzUmVxdWlyZWQ6ICdDb252ZXJzYXRpb24gbmVlZHMgcGFydGljaXBhbnRzIG90aGVyIHRoYW4gdGhlIGN1cnJlbnQgdXNlcicsXG4gIGlzRGVzdHJveWVkOiAnT2JqZWN0IGlzIGRlc3Ryb3llZCcsXG4gIHVybFJlcXVpcmVkOiAnT2JqZWN0IG5lZWRzIGEgdXJsIHByb3BlcnR5JyxcbiAgaW52YWxpZFVybDogJ1VSTCBpcyBpbnZhbGlkJyxcbiAgaW52YWxpZElkOiAnSWRlbnRpZmllciBpcyBpbnZhbGlkJyxcbiAgaWRQYXJhbVJlcXVpcmVkOiAnVGhlIElEIFBhcmFtZXRlciBpcyByZXF1aXJlZCcsXG4gIHdyb25nQ2xhc3M6ICdQYXJhbWV0ZXIgY2xhc3MgZXJyb3I7IHNob3VsZCBiZTogJyxcbiAgaW5Qcm9ncmVzczogJ09wZXJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzJyxcbiAgY2FudENoYW5nZUlmQ29ubmVjdGVkOiAnWW91IGNhbiBub3QgY2hhbmdlIHZhbHVlIGFmdGVyIGNvbm5lY3RpbmcnLFxuICBjYW50Q2hhbmdlVXNlcklkOiAnWW91IGNhbiBub3QgY2hhbmdlIHRoZSB1c2VySWQgcHJvcGVydHknLFxuICBhbHJlYWR5U2VudDogJ0FscmVhZHkgc2VudCBvciBzZW5kaW5nJyxcbiAgY29udGVudFJlcXVpcmVkOiAnTWVzc2FnZVBhcnQgcmVxdWlyZXMgcmljaCBjb250ZW50IGZvciB0aGlzIGNhbGwnLFxuICBhbHJlYWR5RGVzdHJveWVkOiAnVGhpcyBvYmplY3QgaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQnLFxuICBkZWxldGlvbk1vZGVVbnN1cHBvcnRlZDogJ0NhbGwgdG8gZGVsZXRpb24gd2FzIG1hZGUgd2l0aCBhbiB1bnN1cHBvcnRlZCBkZWxldGlvbiBtb2RlJyxcbiAgc2Vzc2lvbkFuZFVzZXJSZXF1aXJlZDogJ2Nvbm5lY3RXaXRoU2Vzc2lvbiByZXF1aXJlcyBib3RoIGEgdXNlcklkIGFuZCBhIHNlc3Npb25Ub2tlbicsXG4gIGludmFsaWRVc2VySWRDaGFuZ2U6ICdUaGUgcHJuIGZpZWxkIGluIHRoZSBJZGVudGl0eSBUb2tlbiBtdXN0IG1hdGNoIHRoZSByZXF1ZXN0ZWQgVXNlcklEJyxcbiAgcHJlZGljYXRlTm90U3VwcG9ydGVkOiAnVGhlIHByZWRpY2F0ZSBpcyBub3Qgc3VwcG9ydGVkIGZvciB0aGlzIHZhbHVlIG9mIG1vZGVsJyxcbiAgaW52YWxpZFByZWRpY2F0ZTogJ1RoZSBwcmVkaWNhdGUgZG9lcyBub3QgbWF0Y2ggdGhlIGV4cGVjdGVkIGZvcm1hdCcsXG4gIGFwcElkSW1tdXRhYmxlOiAnVGhlIGFwcElkIHByb3BlcnR5IGNhbm5vdCBiZSBjaGFuZ2VkJyxcbiAgY2xpZW50TXVzdEJlUmVhZHk6ICdUaGUgQ2xpZW50IG11c3QgaGF2ZSB0cmlnZ2VyZWQgaXRzIFwicmVhZHlcIiBldmVudCBiZWZvcmUgeW91IGNhbiBjYWxsIHRoaXMnLFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMYXllckVycm9yO1xuIl19
