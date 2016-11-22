'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Content class represents Rich Content.
 *
 * Note that instances of this class will automatically be
 * generated for developers based on whether their message parts
 * require it.
 *
 * That means for the most part, you should never need to
 * instantiate one of these directly.
 *
 *      var content = new layer.Content({
 *          id: 'layer:///content/8c839735-5f95-439a-a867-30903c0133f2'
 *      });
 *
 * @class  layer.Content
 * @private
 * @extends layer.Root
 * @author Michael Kantor
 */

var Root = require('./root');
var xhr = require('./xhr');

var Content = function (_Root) {
  _inherits(Content, _Root);

  /**
   * Constructor
   *
   * @method constructor
   * @param  {Object} options
   * @param  {string} options.id - Identifier for the content
   * @param  {string} [options.downloadUrl=null] - Url to download the content from
   * @param  {Date} [options.expiration] - Expiration date for the url
   * @param  {string} [options.refreshUrl] - Url to access to get a new downloadUrl after it has expired
   *
   * @return {layer.Content}
   */
  function Content(options) {
    _classCallCheck(this, Content);

    if (typeof options === 'string') {
      options = { id: options };
    }
    return _possibleConstructorReturn(this, (Content.__proto__ || Object.getPrototypeOf(Content)).call(this, options));
  }

  /**
   * Loads the data from google's cloud storage.
   *
   * Data is provided via callback.
   *
   * Note that typically one should use layer.MessagePart.fetchContent() rather than layer.Content.loadContent()
   *
   * @method loadContent
   * @param {string} mimeType - Mime type for the Blob
   * @param {Function} callback
   * @param {Blob} callback.data - A Blob instance representing the data downloaded.  If Blob object is not available, then may use other format.
   */


  _createClass(Content, [{
    key: 'loadContent',
    value: function loadContent(mimeType, callback) {
      xhr({
        url: this.downloadUrl,
        responseType: 'arraybuffer'
      }, function (result) {
        if (result.success) {
          if (typeof Blob !== 'undefined') {
            var blob = new Blob([result.data], { type: mimeType });
            callback(null, blob);
          } else {
            // If the blob class isn't defined (nodejs) then just return the result as is
            callback(null, result.data);
          }
        } else {
          callback(result.data, null);
        }
      });
    }

    /**
     * Refreshes the URL, which updates the URL and resets the expiration time for the URL
     *
     * @method refreshContent
     * @param {layer.Client} client
     * @param {Function} [callback]
     */

  }, {
    key: 'refreshContent',
    value: function refreshContent(client, callback) {
      var _this2 = this;

      client.xhr({
        url: this.refreshUrl,
        method: 'GET',
        sync: false
      }, function (result) {
        var data = result.data;

        _this2.expiration = new Date(data.expiration);
        _this2.downloadUrl = data.download_url;
        if (callback) callback(_this2.downloadUrl);
      });
    }

    /**
     * Is the download url expired or about to expire?
     * We can't be sure of the state of the device's internal clock,
     * so if its within 10 minutes of expiring, just treat it as expired.
     *
     * @method isExpired
     * @returns {Boolean}
     */

  }, {
    key: 'isExpired',
    value: function isExpired() {
      var expirationLeeway = 10 * 60 * 1000;
      return this.expiration.getTime() - expirationLeeway < Date.now();
    }

    /**
     * Creates a MessagePart from a server representation of the part
     *
     * @method _createFromServer
     * @private
     * @static
     * @param  {Object} part - Server representation of a part
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(part) {
      return new Content({
        id: part.id,
        downloadUrl: part.download_url,
        expiration: new Date(part.expiration),
        refreshUrl: part.refresh_url
      });
    }
  }]);

  return Content;
}(Root);

/**
 * Server generated identifier
 * @type {string}
 */


Content.prototype.id = '';

Content.prototype.blob = null;

/**
 * Server generated url for downloading the content
 * @type {string}
 */
Content.prototype.downloadUrl = '';

/**
 * Url for refreshing the downloadUrl after it has expired
 * @type {string}
 */
Content.prototype.refreshUrl = '';

/**
 * Size of the content.
 *
 * This property only has a value when in the process
 * of Creating the rich content and sending the Message.
 *
 * @type {number}
 */
Content.prototype.size = 0;

/**
 * Expiration date for the downloadUrl
 * @type {Date}
 */
Content.prototype.expiration = null;

Root.initClass.apply(Content, [Content, 'Content']);
module.exports = Content;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb250ZW50LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwieGhyIiwiQ29udGVudCIsIm9wdGlvbnMiLCJpZCIsIm1pbWVUeXBlIiwiY2FsbGJhY2siLCJ1cmwiLCJkb3dubG9hZFVybCIsInJlc3BvbnNlVHlwZSIsInJlc3VsdCIsInN1Y2Nlc3MiLCJCbG9iIiwiYmxvYiIsImRhdGEiLCJ0eXBlIiwiY2xpZW50IiwicmVmcmVzaFVybCIsIm1ldGhvZCIsInN5bmMiLCJleHBpcmF0aW9uIiwiRGF0ZSIsImRvd25sb2FkX3VybCIsImV4cGlyYXRpb25MZWV3YXkiLCJnZXRUaW1lIiwibm93IiwicGFydCIsInJlZnJlc2hfdXJsIiwicHJvdG90eXBlIiwic2l6ZSIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9CQSxJQUFNQSxPQUFPQyxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU1DLE1BQU1ELFFBQVEsT0FBUixDQUFaOztJQUVNRSxPOzs7QUFFSjs7Ozs7Ozs7Ozs7O0FBWUEsbUJBQVlDLE9BQVosRUFBcUI7QUFBQTs7QUFDbkIsUUFBSSxPQUFPQSxPQUFQLEtBQW1CLFFBQXZCLEVBQWlDO0FBQy9CQSxnQkFBVSxFQUFFQyxJQUFJRCxPQUFOLEVBQVY7QUFDRDtBQUhrQiw2R0FJYkEsT0FKYTtBQUtwQjs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OztnQ0FZWUUsUSxFQUFVQyxRLEVBQVU7QUFDOUJMLFVBQUk7QUFDRk0sYUFBSyxLQUFLQyxXQURSO0FBRUZDLHNCQUFjO0FBRlosT0FBSixFQUdHLGtCQUFVO0FBQ1gsWUFBSUMsT0FBT0MsT0FBWCxFQUFvQjtBQUNsQixjQUFJLE9BQU9DLElBQVAsS0FBZ0IsV0FBcEIsRUFBaUM7QUFDL0IsZ0JBQU1DLE9BQU8sSUFBSUQsSUFBSixDQUFTLENBQUNGLE9BQU9JLElBQVIsQ0FBVCxFQUF3QixFQUFFQyxNQUFNVixRQUFSLEVBQXhCLENBQWI7QUFDQUMscUJBQVMsSUFBVCxFQUFlTyxJQUFmO0FBQ0QsV0FIRCxNQUdPO0FBQ0w7QUFDQVAscUJBQVMsSUFBVCxFQUFlSSxPQUFPSSxJQUF0QjtBQUNEO0FBQ0YsU0FSRCxNQVFPO0FBQ0xSLG1CQUFTSSxPQUFPSSxJQUFoQixFQUFzQixJQUF0QjtBQUNEO0FBQ0YsT0FmRDtBQWdCRDs7QUFFRDs7Ozs7Ozs7OzttQ0FPZUUsTSxFQUFRVixRLEVBQVU7QUFBQTs7QUFDL0JVLGFBQU9mLEdBQVAsQ0FBVztBQUNUTSxhQUFLLEtBQUtVLFVBREQ7QUFFVEMsZ0JBQVEsS0FGQztBQUdUQyxjQUFNO0FBSEcsT0FBWCxFQUlHLGtCQUFVO0FBQUEsWUFDSEwsSUFERyxHQUNNSixNQUROLENBQ0hJLElBREc7O0FBRVgsZUFBS00sVUFBTCxHQUFrQixJQUFJQyxJQUFKLENBQVNQLEtBQUtNLFVBQWQsQ0FBbEI7QUFDQSxlQUFLWixXQUFMLEdBQW1CTSxLQUFLUSxZQUF4QjtBQUNBLFlBQUloQixRQUFKLEVBQWNBLFNBQVMsT0FBS0UsV0FBZDtBQUNmLE9BVEQ7QUFVRDs7QUFFRDs7Ozs7Ozs7Ozs7Z0NBUVk7QUFDVixVQUFNZSxtQkFBbUIsS0FBSyxFQUFMLEdBQVUsSUFBbkM7QUFDQSxhQUFRLEtBQUtILFVBQUwsQ0FBZ0JJLE9BQWhCLEtBQTRCRCxnQkFBNUIsR0FBK0NGLEtBQUtJLEdBQUwsRUFBdkQ7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7c0NBUXlCQyxJLEVBQU07QUFDN0IsYUFBTyxJQUFJeEIsT0FBSixDQUFZO0FBQ2pCRSxZQUFJc0IsS0FBS3RCLEVBRFE7QUFFakJJLHFCQUFha0IsS0FBS0osWUFGRDtBQUdqQkYsb0JBQVksSUFBSUMsSUFBSixDQUFTSyxLQUFLTixVQUFkLENBSEs7QUFJakJILG9CQUFZUyxLQUFLQztBQUpBLE9BQVosQ0FBUDtBQU1EOzs7O0VBcEdtQjVCLEk7O0FBdUd0Qjs7Ozs7O0FBSUFHLFFBQVEwQixTQUFSLENBQWtCeEIsRUFBbEIsR0FBdUIsRUFBdkI7O0FBRUFGLFFBQVEwQixTQUFSLENBQWtCZixJQUFsQixHQUF5QixJQUF6Qjs7QUFFQTs7OztBQUlBWCxRQUFRMEIsU0FBUixDQUFrQnBCLFdBQWxCLEdBQWdDLEVBQWhDOztBQUVBOzs7O0FBSUFOLFFBQVEwQixTQUFSLENBQWtCWCxVQUFsQixHQUErQixFQUEvQjs7QUFFQTs7Ozs7Ozs7QUFRQWYsUUFBUTBCLFNBQVIsQ0FBa0JDLElBQWxCLEdBQXlCLENBQXpCOztBQUVBOzs7O0FBSUEzQixRQUFRMEIsU0FBUixDQUFrQlIsVUFBbEIsR0FBK0IsSUFBL0I7O0FBRUFyQixLQUFLK0IsU0FBTCxDQUFlQyxLQUFmLENBQXFCN0IsT0FBckIsRUFBOEIsQ0FBQ0EsT0FBRCxFQUFVLFNBQVYsQ0FBOUI7QUFDQThCLE9BQU9DLE9BQVAsR0FBaUIvQixPQUFqQiIsImZpbGUiOiJjb250ZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgQ29udGVudCBjbGFzcyByZXByZXNlbnRzIFJpY2ggQ29udGVudC5cbiAqXG4gKiBOb3RlIHRoYXQgaW5zdGFuY2VzIG9mIHRoaXMgY2xhc3Mgd2lsbCBhdXRvbWF0aWNhbGx5IGJlXG4gKiBnZW5lcmF0ZWQgZm9yIGRldmVsb3BlcnMgYmFzZWQgb24gd2hldGhlciB0aGVpciBtZXNzYWdlIHBhcnRzXG4gKiByZXF1aXJlIGl0LlxuICpcbiAqIFRoYXQgbWVhbnMgZm9yIHRoZSBtb3N0IHBhcnQsIHlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0b1xuICogaW5zdGFudGlhdGUgb25lIG9mIHRoZXNlIGRpcmVjdGx5LlxuICpcbiAqICAgICAgdmFyIGNvbnRlbnQgPSBuZXcgbGF5ZXIuQ29udGVudCh7XG4gKiAgICAgICAgICBpZDogJ2xheWVyOi8vL2NvbnRlbnQvOGM4Mzk3MzUtNWY5NS00MzlhLWE4NjctMzA5MDNjMDEzM2YyJ1xuICogICAgICB9KTtcbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNvbnRlbnRcbiAqIEBwcml2YXRlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYXV0aG9yIE1pY2hhZWwgS2FudG9yXG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgeGhyID0gcmVxdWlyZSgnLi94aHInKTtcblxuY2xhc3MgQ29udGVudCBleHRlbmRzIFJvb3Qge1xuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RvclxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9wdGlvbnMuaWQgLSBJZGVudGlmaWVyIGZvciB0aGUgY29udGVudFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IFtvcHRpb25zLmRvd25sb2FkVXJsPW51bGxdIC0gVXJsIHRvIGRvd25sb2FkIHRoZSBjb250ZW50IGZyb21cbiAgICogQHBhcmFtICB7RGF0ZX0gW29wdGlvbnMuZXhwaXJhdGlvbl0gLSBFeHBpcmF0aW9uIGRhdGUgZm9yIHRoZSB1cmxcbiAgICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5yZWZyZXNoVXJsXSAtIFVybCB0byBhY2Nlc3MgdG8gZ2V0IGEgbmV3IGRvd25sb2FkVXJsIGFmdGVyIGl0IGhhcyBleHBpcmVkXG4gICAqXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnRlbnR9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJykge1xuICAgICAgb3B0aW9ucyA9IHsgaWQ6IG9wdGlvbnMgfTtcbiAgICB9XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZHMgdGhlIGRhdGEgZnJvbSBnb29nbGUncyBjbG91ZCBzdG9yYWdlLlxuICAgKlxuICAgKiBEYXRhIGlzIHByb3ZpZGVkIHZpYSBjYWxsYmFjay5cbiAgICpcbiAgICogTm90ZSB0aGF0IHR5cGljYWxseSBvbmUgc2hvdWxkIHVzZSBsYXllci5NZXNzYWdlUGFydC5mZXRjaENvbnRlbnQoKSByYXRoZXIgdGhhbiBsYXllci5Db250ZW50LmxvYWRDb250ZW50KClcbiAgICpcbiAgICogQG1ldGhvZCBsb2FkQ29udGVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWltZVR5cGUgLSBNaW1lIHR5cGUgZm9yIHRoZSBCbG9iXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7QmxvYn0gY2FsbGJhY2suZGF0YSAtIEEgQmxvYiBpbnN0YW5jZSByZXByZXNlbnRpbmcgdGhlIGRhdGEgZG93bmxvYWRlZC4gIElmIEJsb2Igb2JqZWN0IGlzIG5vdCBhdmFpbGFibGUsIHRoZW4gbWF5IHVzZSBvdGhlciBmb3JtYXQuXG4gICAqL1xuICBsb2FkQ29udGVudChtaW1lVHlwZSwgY2FsbGJhY2spIHtcbiAgICB4aHIoe1xuICAgICAgdXJsOiB0aGlzLmRvd25sb2FkVXJsLFxuICAgICAgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInLFxuICAgIH0sIHJlc3VsdCA9PiB7XG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcmVzdWx0LmRhdGFdLCB7IHR5cGU6IG1pbWVUeXBlIH0pO1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGJsb2IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIElmIHRoZSBibG9iIGNsYXNzIGlzbid0IGRlZmluZWQgKG5vZGVqcykgdGhlbiBqdXN0IHJldHVybiB0aGUgcmVzdWx0IGFzIGlzXG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHQuZGF0YSwgbnVsbCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVmcmVzaGVzIHRoZSBVUkwsIHdoaWNoIHVwZGF0ZXMgdGhlIFVSTCBhbmQgcmVzZXRzIHRoZSBleHBpcmF0aW9uIHRpbWUgZm9yIHRoZSBVUkxcbiAgICpcbiAgICogQG1ldGhvZCByZWZyZXNoQ29udGVudFxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICovXG4gIHJlZnJlc2hDb250ZW50KGNsaWVudCwgY2FsbGJhY2spIHtcbiAgICBjbGllbnQueGhyKHtcbiAgICAgIHVybDogdGhpcy5yZWZyZXNoVXJsLFxuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHN5bmM6IGZhbHNlLFxuICAgIH0sIHJlc3VsdCA9PiB7XG4gICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3VsdDtcbiAgICAgIHRoaXMuZXhwaXJhdGlvbiA9IG5ldyBEYXRlKGRhdGEuZXhwaXJhdGlvbik7XG4gICAgICB0aGlzLmRvd25sb2FkVXJsID0gZGF0YS5kb3dubG9hZF91cmw7XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHRoaXMuZG93bmxvYWRVcmwpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElzIHRoZSBkb3dubG9hZCB1cmwgZXhwaXJlZCBvciBhYm91dCB0byBleHBpcmU/XG4gICAqIFdlIGNhbid0IGJlIHN1cmUgb2YgdGhlIHN0YXRlIG9mIHRoZSBkZXZpY2UncyBpbnRlcm5hbCBjbG9jayxcbiAgICogc28gaWYgaXRzIHdpdGhpbiAxMCBtaW51dGVzIG9mIGV4cGlyaW5nLCBqdXN0IHRyZWF0IGl0IGFzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBtZXRob2QgaXNFeHBpcmVkXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNFeHBpcmVkKCkge1xuICAgIGNvbnN0IGV4cGlyYXRpb25MZWV3YXkgPSAxMCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gKHRoaXMuZXhwaXJhdGlvbi5nZXRUaW1lKCkgLSBleHBpcmF0aW9uTGVld2F5IDwgRGF0ZS5ub3coKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIE1lc3NhZ2VQYXJ0IGZyb20gYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIHBhcnRcbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gcGFydCAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiBhIHBhcnRcbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihwYXJ0KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZW50KHtcbiAgICAgIGlkOiBwYXJ0LmlkLFxuICAgICAgZG93bmxvYWRVcmw6IHBhcnQuZG93bmxvYWRfdXJsLFxuICAgICAgZXhwaXJhdGlvbjogbmV3IERhdGUocGFydC5leHBpcmF0aW9uKSxcbiAgICAgIHJlZnJlc2hVcmw6IHBhcnQucmVmcmVzaF91cmwsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXJ2ZXIgZ2VuZXJhdGVkIGlkZW50aWZpZXJcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbkNvbnRlbnQucHJvdG90eXBlLmlkID0gJyc7XG5cbkNvbnRlbnQucHJvdG90eXBlLmJsb2IgPSBudWxsO1xuXG4vKipcbiAqIFNlcnZlciBnZW5lcmF0ZWQgdXJsIGZvciBkb3dubG9hZGluZyB0aGUgY29udGVudFxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuQ29udGVudC5wcm90b3R5cGUuZG93bmxvYWRVcmwgPSAnJztcblxuLyoqXG4gKiBVcmwgZm9yIHJlZnJlc2hpbmcgdGhlIGRvd25sb2FkVXJsIGFmdGVyIGl0IGhhcyBleHBpcmVkXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5Db250ZW50LnByb3RvdHlwZS5yZWZyZXNoVXJsID0gJyc7XG5cbi8qKlxuICogU2l6ZSBvZiB0aGUgY29udGVudC5cbiAqXG4gKiBUaGlzIHByb3BlcnR5IG9ubHkgaGFzIGEgdmFsdWUgd2hlbiBpbiB0aGUgcHJvY2Vzc1xuICogb2YgQ3JlYXRpbmcgdGhlIHJpY2ggY29udGVudCBhbmQgc2VuZGluZyB0aGUgTWVzc2FnZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5Db250ZW50LnByb3RvdHlwZS5zaXplID0gMDtcblxuLyoqXG4gKiBFeHBpcmF0aW9uIGRhdGUgZm9yIHRoZSBkb3dubG9hZFVybFxuICogQHR5cGUge0RhdGV9XG4gKi9cbkNvbnRlbnQucHJvdG90eXBlLmV4cGlyYXRpb24gPSBudWxsO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDb250ZW50LCBbQ29udGVudCwgJ0NvbnRlbnQnXSk7XG5tb2R1bGUuZXhwb3J0cyA9IENvbnRlbnQ7XG4iXX0=
