'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Announcement class represents a type of Message sent by a server.
 *
 * Announcements can not be sent using the WebSDK, only received.
 *
 * You should never need to instantiate an Announcement; they should only be
 * delivered via `messages:add` events when an Announcement is provided via
 * websocket to the client, and `change` events on an Announcements Query.
 *
 * @class  layer.Announcement
 * @extends layer.Message
 */

var Message = require('./message');
var Syncable = require('./syncable');
var Root = require('./root');
var LayerError = require('./layer-error');

var Announcement = function (_Message) {
  _inherits(Announcement, _Message);

  function Announcement() {
    _classCallCheck(this, Announcement);

    return _possibleConstructorReturn(this, (Announcement.__proto__ || Object.getPrototypeOf(Announcement)).apply(this, arguments));
  }

  _createClass(Announcement, [{
    key: 'send',
    value: function send() {}
  }, {
    key: 'getConversation',
    value: function getConversation() {}
  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.getClient()._addMessage(this);
    }

    /**
     * Delete the Announcement from the server.
     *
     * @method delete
     */

  }, {
    key: 'delete',
    value: function _delete() {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);

      var id = this.id;
      var client = this.getClient();
      this._xhr({
        url: '',
        method: 'DELETE'
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Syncable.load(id, client);
      });

      this._deleted();
      this.destroy();
    }

    /**
     * Creates an Announcement from the server's representation of an Announcement.
     *
     * Similar to _populateFromServer, however, this method takes a
     * message description and returns a new message instance using _populateFromServer
     * to setup the values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} message - Server's representation of the announcement
     * @return {layer.Announcement}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      return new Announcement({
        fromServer: message,
        clientId: client.appId,
        _notify: fromWebsocket && message.is_unread
      });
    }
  }]);

  return Announcement;
}(Message);

Announcement.prefixUUID = 'layer:///announcements/';

Announcement.inObjectIgnore = Message.inObjectIgnore;

Announcement.bubbleEventParent = 'getClient';

Announcement._supportedEvents = [].concat(Message._supportedEvents);

Root.initClass.apply(Announcement, [Announcement, 'Announcement']);
Syncable.subclasses.push(Announcement);
module.exports = Announcement;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hbm5vdW5jZW1lbnQuanMiXSwibmFtZXMiOlsiTWVzc2FnZSIsInJlcXVpcmUiLCJTeW5jYWJsZSIsIlJvb3QiLCJMYXllckVycm9yIiwiQW5ub3VuY2VtZW50IiwiZGF0YSIsImdldENsaWVudCIsIl9hZGRNZXNzYWdlIiwiaXNEZXN0cm95ZWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJpZCIsImNsaWVudCIsIl94aHIiLCJ1cmwiLCJtZXRob2QiLCJyZXN1bHQiLCJzdWNjZXNzIiwibG9hZCIsIl9kZWxldGVkIiwiZGVzdHJveSIsIm1lc3NhZ2UiLCJmcm9tV2Vic29ja2V0IiwiZnJvbVNlcnZlciIsImNsaWVudElkIiwiYXBwSWQiLCJfbm90aWZ5IiwiaXNfdW5yZWFkIiwicHJlZml4VVVJRCIsImluT2JqZWN0SWdub3JlIiwiYnViYmxlRXZlbnRQYXJlbnQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJzdWJjbGFzc2VzIiwicHVzaCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFDQTs7Ozs7Ozs7Ozs7OztBQWFBLElBQU1BLFVBQVVDLFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU1DLFdBQVdELFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU1FLE9BQU9GLFFBQVEsUUFBUixDQUFiO0FBQ0EsSUFBTUcsYUFBYUgsUUFBUSxlQUFSLENBQW5COztJQUdNSSxZOzs7Ozs7Ozs7OzsyQkFDRyxDQUFFOzs7c0NBQ1MsQ0FBRTs7OzRCQUVaQyxJLEVBQU07QUFDWixXQUFLQyxTQUFMLEdBQWlCQyxXQUFqQixDQUE2QixJQUE3QjtBQUNEOztBQUVEOzs7Ozs7Ozs4QkFLUztBQUNQLFVBQUksS0FBS0MsV0FBVCxFQUFzQixNQUFNLElBQUlDLEtBQUosQ0FBVU4sV0FBV08sVUFBWCxDQUFzQkYsV0FBaEMsQ0FBTjs7QUFFdEIsVUFBTUcsS0FBSyxLQUFLQSxFQUFoQjtBQUNBLFVBQU1DLFNBQVMsS0FBS04sU0FBTCxFQUFmO0FBQ0EsV0FBS08sSUFBTCxDQUFVO0FBQ1JDLGFBQUssRUFERztBQUVSQyxnQkFBUTtBQUZBLE9BQVYsRUFHRyxrQkFBVTtBQUNYLFlBQUksQ0FBQ0MsT0FBT0MsT0FBUixLQUFvQixDQUFDRCxPQUFPWCxJQUFSLElBQWdCVyxPQUFPWCxJQUFQLENBQVlNLEVBQVosS0FBbUIsV0FBdkQsQ0FBSixFQUF5RVYsU0FBU2lCLElBQVQsQ0FBY1AsRUFBZCxFQUFrQkMsTUFBbEI7QUFDMUUsT0FMRDs7QUFPQSxXQUFLTyxRQUFMO0FBQ0EsV0FBS0MsT0FBTDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7O3NDQWF5QkMsTyxFQUFTVCxNLEVBQVE7QUFDeEMsVUFBTVUsZ0JBQWdCRCxRQUFRQyxhQUE5QjtBQUNBLGFBQU8sSUFBSWxCLFlBQUosQ0FBaUI7QUFDdEJtQixvQkFBWUYsT0FEVTtBQUV0Qkcsa0JBQVVaLE9BQU9hLEtBRks7QUFHdEJDLGlCQUFTSixpQkFBaUJELFFBQVFNO0FBSFosT0FBakIsQ0FBUDtBQUtEOzs7O0VBakR3QjVCLE87O0FBb0QzQkssYUFBYXdCLFVBQWIsR0FBMEIseUJBQTFCOztBQUVBeEIsYUFBYXlCLGNBQWIsR0FBOEI5QixRQUFROEIsY0FBdEM7O0FBRUF6QixhQUFhMEIsaUJBQWIsR0FBaUMsV0FBakM7O0FBRUExQixhQUFhMkIsZ0JBQWIsR0FBZ0MsR0FBR0MsTUFBSCxDQUFVakMsUUFBUWdDLGdCQUFsQixDQUFoQzs7QUFFQTdCLEtBQUsrQixTQUFMLENBQWVDLEtBQWYsQ0FBcUI5QixZQUFyQixFQUFtQyxDQUFDQSxZQUFELEVBQWUsY0FBZixDQUFuQztBQUNBSCxTQUFTa0MsVUFBVCxDQUFvQkMsSUFBcEIsQ0FBeUJoQyxZQUF6QjtBQUNBaUMsT0FBT0MsT0FBUCxHQUFpQmxDLFlBQWpCIiwiZmlsZSI6ImFubm91bmNlbWVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuLyoqXG4gKiBUaGUgQW5ub3VuY2VtZW50IGNsYXNzIHJlcHJlc2VudHMgYSB0eXBlIG9mIE1lc3NhZ2Ugc2VudCBieSBhIHNlcnZlci5cbiAqXG4gKiBBbm5vdW5jZW1lbnRzIGNhbiBub3QgYmUgc2VudCB1c2luZyB0aGUgV2ViU0RLLCBvbmx5IHJlY2VpdmVkLlxuICpcbiAqIFlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0byBpbnN0YW50aWF0ZSBhbiBBbm5vdW5jZW1lbnQ7IHRoZXkgc2hvdWxkIG9ubHkgYmVcbiAqIGRlbGl2ZXJlZCB2aWEgYG1lc3NhZ2VzOmFkZGAgZXZlbnRzIHdoZW4gYW4gQW5ub3VuY2VtZW50IGlzIHByb3ZpZGVkIHZpYVxuICogd2Vic29ja2V0IHRvIHRoZSBjbGllbnQsIGFuZCBgY2hhbmdlYCBldmVudHMgb24gYW4gQW5ub3VuY2VtZW50cyBRdWVyeS5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLkFubm91bmNlbWVudFxuICogQGV4dGVuZHMgbGF5ZXIuTWVzc2FnZVxuICovXG5cbmNvbnN0IE1lc3NhZ2UgPSByZXF1aXJlKCcuL21lc3NhZ2UnKTtcbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcblxuXG5jbGFzcyBBbm5vdW5jZW1lbnQgZXh0ZW5kcyBNZXNzYWdlIHtcbiAgc2VuZCgpIHt9XG4gIGdldENvbnZlcnNhdGlvbigpIHt9XG5cbiAgX2xvYWRlZChkYXRhKSB7XG4gICAgdGhpcy5nZXRDbGllbnQoKS5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIEFubm91bmNlbWVudCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlXG4gICAqL1xuICBkZWxldGUoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuXG4gICAgY29uc3QgaWQgPSB0aGlzLmlkO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJycsXG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgIH0sIHJlc3VsdCA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmICghcmVzdWx0LmRhdGEgfHwgcmVzdWx0LmRhdGEuaWQgIT09ICdub3RfZm91bmQnKSkgU3luY2FibGUubG9hZChpZCwgY2xpZW50KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIEFubm91bmNlbWVudCBmcm9tIHRoZSBzZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiBhbiBBbm5vdW5jZW1lbnQuXG4gICAqXG4gICAqIFNpbWlsYXIgdG8gX3BvcHVsYXRlRnJvbVNlcnZlciwgaG93ZXZlciwgdGhpcyBtZXRob2QgdGFrZXMgYVxuICAgKiBtZXNzYWdlIGRlc2NyaXB0aW9uIGFuZCByZXR1cm5zIGEgbmV3IG1lc3NhZ2UgaW5zdGFuY2UgdXNpbmcgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiB0byBzZXR1cCB0aGUgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1lc3NhZ2UgLSBTZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiB0aGUgYW5ub3VuY2VtZW50XG4gICAqIEByZXR1cm4ge2xheWVyLkFubm91bmNlbWVudH1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZXNzYWdlLCBjbGllbnQpIHtcbiAgICBjb25zdCBmcm9tV2Vic29ja2V0ID0gbWVzc2FnZS5mcm9tV2Vic29ja2V0O1xuICAgIHJldHVybiBuZXcgQW5ub3VuY2VtZW50KHtcbiAgICAgIGZyb21TZXJ2ZXI6IG1lc3NhZ2UsXG4gICAgICBjbGllbnRJZDogY2xpZW50LmFwcElkLFxuICAgICAgX25vdGlmeTogZnJvbVdlYnNvY2tldCAmJiBtZXNzYWdlLmlzX3VucmVhZCxcbiAgICB9KTtcbiAgfVxufVxuXG5Bbm5vdW5jZW1lbnQucHJlZml4VVVJRCA9ICdsYXllcjovLy9hbm5vdW5jZW1lbnRzLyc7XG5cbkFubm91bmNlbWVudC5pbk9iamVjdElnbm9yZSA9IE1lc3NhZ2UuaW5PYmplY3RJZ25vcmU7XG5cbkFubm91bmNlbWVudC5idWJibGVFdmVudFBhcmVudCA9ICdnZXRDbGllbnQnO1xuXG5Bbm5vdW5jZW1lbnQuX3N1cHBvcnRlZEV2ZW50cyA9IFtdLmNvbmNhdChNZXNzYWdlLl9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShBbm5vdW5jZW1lbnQsIFtBbm5vdW5jZW1lbnQsICdBbm5vdW5jZW1lbnQnXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goQW5ub3VuY2VtZW50KTtcbm1vZHVsZS5leHBvcnRzID0gQW5ub3VuY2VtZW50O1xuIl19
