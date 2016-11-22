'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TypingPublisher = require('./typing-publisher');

var _require = require('./typing-indicators'),
    STARTED = _require.STARTED,
    PAUSED = _require.PAUSED,
    FINISHED = _require.FINISHED;

/**
 * The Typing Listener Class listens to keyboard events on
 * your text field, and uses the layer.TypingPublisher to
 * send state based on keyboard behavior.
 *
 *      var typingListener = client.createTypingListener(document.getElementById('mytextarea'));
 *
 *  You change what Conversation
 *  the typing indicator reports your user to be typing
 *  in by calling:
 *
 *      typingListener.setConversation(mySelectedConversation);
 *
 * There are two ways of cleaning up all pointers to your input so it can be garbage collected:
 *
 * 1. Destroy the listener:
 *
 *        typingListener.destroy();
 *
 * 2. Remove or replace the input:
 *
 *        typingListener.setInput(null);
 *        typingListener.setInput(newInput);
 *
 * @class  layer.TypingIndicators.TypingListener
 */


var TypingListener = function () {

  /**
   * Create a TypingListener that listens for the user's typing.
   *
   * The TypingListener needs
   * to know what Conversation the user is typing into... but it does not require that parameter during initialization.
   *
   * @method constructor
   * @param  {Object} args
   * @param {string} args.clientId - The ID of the client; used so that the TypingPublisher can access its websocket manager*
   * @param {HTMLElement} [args.input=null] - A Text editor dom node that will have typing indicators
   * @param {Object} [args.conversation=null] - The Conversation Object or Instance that the input will send messages to
   */
  function TypingListener(args) {
    _classCallCheck(this, TypingListener);

    this.clientId = args.clientId;
    this.conversation = args.conversation;
    this.publisher = new TypingPublisher({
      clientId: this.clientId,
      conversation: this.conversation
    });

    this.intervalId = 0;
    this.lastKeyId = 0;

    this._handleKeyPress = this._handleKeyPress.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this.setInput(args.input);
  }

  _createClass(TypingListener, [{
    key: 'destroy',
    value: function destroy() {
      this._removeInput(this.input);
      this.publisher.destroy();
    }

    /**
     * Change the input being tracked by your TypingListener.
     *
     * If you are removing your input from the DOM, you can simply call
     *
     *     typingListener.setInput(null);
     *
     * And all event handlers will be removed, allowing for garbage collection
     * to cleanup your input.
     *
     * You can also call setInput with a newly created input:
     *
     *     var input = document.createElement('input');
     *     typingListener.setInput(input);
     *
     * @method setInput
     * @param {HTMLElement} input - Textarea or text input
     */

  }, {
    key: 'setInput',
    value: function setInput(input) {
      if (input !== this.input) {
        this._removeInput(this.input);
        this.input = input;

        // Use keypress rather than keydown because the user hitting alt-tab to change
        // windows, and other meta keys should not result in typing indicators
        this.input.addEventListener('keypress', this._handleKeyPress);
        this.input.addEventListener('keydown', this._handleKeyDown);
      }
    }

    /**
     * Cleanup and remove all links and callbacks keeping input from being garbage collected.
     *
     * @method _removeInput
     * @private
     * @param {HTMLElement} input - Textarea or text input
     */

  }, {
    key: '_removeInput',
    value: function _removeInput(input) {
      if (input) {
        input.removeEventListener('keypress', this._handleKeyPress);
        input.removeEventListener('keydown', this._handleKeyDown);
        this.input = null;
      }
    }

    /**
     * Change the Conversation; this should set the state of the old Conversation to "finished".
     *
     * Use this when the user has changed Conversations and you want to report on typing to a new
     * Conversation.
     *
     * @method setConversation
     * @param  {Object} conv - The new Conversation Object or Instance
     */

  }, {
    key: 'setConversation',
    value: function setConversation(conv) {
      if (conv !== this.conversation) {
        this.conversation = conv;
        this.publisher.setConversation(conv);
      }
    }

    /**
     * Whenever the key is pressed, send a "started" or "finished" event.
     *
     * If its a "start" event, schedule a pause-test that will send
     * a "pause" event if typing stops.
     *
     * @method _handleKeyPress
     * @private
     * @param  {KeyboardEvent} evt
     */

  }, {
    key: '_handleKeyPress',
    value: function _handleKeyPress(evt) {
      var _this = this;

      if (this.lastKeyId) window.clearTimeout(this.lastKeyId);
      this.lastKeyId = window.setTimeout(function () {
        _this.lastKeyId = 0;
        var isEmpty = !Boolean(_this.input.value);
        _this.send(isEmpty ? FINISHED : STARTED);
      }, 50);
    }

    /**
     * Handles keyboard keys not reported by on by keypress events.
     *
     * These keys can be detected with keyDown event handlers. The ones
     * currently handled here are backspace, delete and enter.
     * We may add more later.
     *
     * @method _handleKeyDown
     * @private
     * @param  {KeyboardEvent} evt
     */

  }, {
    key: '_handleKeyDown',
    value: function _handleKeyDown(evt) {
      if ([8, 46, 13].indexOf(evt.keyCode) !== -1) this._handleKeyPress();
    }

    /**
     * Send the state to the publisher.
     *
     * If your application requires
     * you to directly control the state, you can call this method;
     * however, as long as you use this TypingListener, keyboard
     * events will overwrite any state changes you send.
     *
     * Common use case for this: After a message is sent, you want to clear any typing indicators:
     *
     *      function send() {
     *        message.send();
     *        typingIndicators.send(layer.TypingIndicators.FINISHED);
     *      }
     *
     * @method send
     * @param  {string} state - One of "started", "paused", "finished"
     */

  }, {
    key: 'send',
    value: function send(state) {
      this.publisher.setState(state);
    }
  }]);

  return TypingListener;
}();

module.exports = TypingListener;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctbGlzdGVuZXIuanMiXSwibmFtZXMiOlsiVHlwaW5nUHVibGlzaGVyIiwicmVxdWlyZSIsIlNUQVJURUQiLCJQQVVTRUQiLCJGSU5JU0hFRCIsIlR5cGluZ0xpc3RlbmVyIiwiYXJncyIsImNsaWVudElkIiwiY29udmVyc2F0aW9uIiwicHVibGlzaGVyIiwiaW50ZXJ2YWxJZCIsImxhc3RLZXlJZCIsIl9oYW5kbGVLZXlQcmVzcyIsImJpbmQiLCJfaGFuZGxlS2V5RG93biIsInNldElucHV0IiwiaW5wdXQiLCJfcmVtb3ZlSW5wdXQiLCJkZXN0cm95IiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJjb252Iiwic2V0Q29udmVyc2F0aW9uIiwiZXZ0Iiwid2luZG93IiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImlzRW1wdHkiLCJCb29sZWFuIiwidmFsdWUiLCJzZW5kIiwiaW5kZXhPZiIsImtleUNvZGUiLCJzdGF0ZSIsInNldFN0YXRlIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBTUEsa0JBQWtCQyxRQUFRLG9CQUFSLENBQXhCOztlQUNvQ0EsUUFBUSxxQkFBUixDO0lBQTdCQyxPLFlBQUFBLE87SUFBU0MsTSxZQUFBQSxNO0lBQVFDLFEsWUFBQUEsUTs7QUFFeEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUEwQk1DLGM7O0FBRUo7Ozs7Ozs7Ozs7OztBQVlBLDBCQUFZQyxJQUFaLEVBQWtCO0FBQUE7O0FBQ2hCLFNBQUtDLFFBQUwsR0FBZ0JELEtBQUtDLFFBQXJCO0FBQ0EsU0FBS0MsWUFBTCxHQUFvQkYsS0FBS0UsWUFBekI7QUFDQSxTQUFLQyxTQUFMLEdBQWlCLElBQUlULGVBQUosQ0FBb0I7QUFDbkNPLGdCQUFVLEtBQUtBLFFBRG9CO0FBRW5DQyxvQkFBYyxLQUFLQTtBQUZnQixLQUFwQixDQUFqQjs7QUFLQSxTQUFLRSxVQUFMLEdBQWtCLENBQWxCO0FBQ0EsU0FBS0MsU0FBTCxHQUFpQixDQUFqQjs7QUFFQSxTQUFLQyxlQUFMLEdBQXVCLEtBQUtBLGVBQUwsQ0FBcUJDLElBQXJCLENBQTBCLElBQTFCLENBQXZCO0FBQ0EsU0FBS0MsY0FBTCxHQUFzQixLQUFLQSxjQUFMLENBQW9CRCxJQUFwQixDQUF5QixJQUF6QixDQUF0QjtBQUNBLFNBQUtFLFFBQUwsQ0FBY1QsS0FBS1UsS0FBbkI7QUFDRDs7Ozs4QkFFUztBQUNSLFdBQUtDLFlBQUwsQ0FBa0IsS0FBS0QsS0FBdkI7QUFDQSxXQUFLUCxTQUFMLENBQWVTLE9BQWY7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzZCQWtCU0YsSyxFQUFPO0FBQ2QsVUFBSUEsVUFBVSxLQUFLQSxLQUFuQixFQUEwQjtBQUN4QixhQUFLQyxZQUFMLENBQWtCLEtBQUtELEtBQXZCO0FBQ0EsYUFBS0EsS0FBTCxHQUFhQSxLQUFiOztBQUVBO0FBQ0E7QUFDQSxhQUFLQSxLQUFMLENBQVdHLGdCQUFYLENBQTRCLFVBQTVCLEVBQXdDLEtBQUtQLGVBQTdDO0FBQ0EsYUFBS0ksS0FBTCxDQUFXRyxnQkFBWCxDQUE0QixTQUE1QixFQUF1QyxLQUFLTCxjQUE1QztBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7aUNBT2FFLEssRUFBTztBQUNsQixVQUFJQSxLQUFKLEVBQVc7QUFDVEEsY0FBTUksbUJBQU4sQ0FBMEIsVUFBMUIsRUFBc0MsS0FBS1IsZUFBM0M7QUFDQUksY0FBTUksbUJBQU4sQ0FBMEIsU0FBMUIsRUFBcUMsS0FBS04sY0FBMUM7QUFDQSxhQUFLRSxLQUFMLEdBQWEsSUFBYjtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7OztvQ0FTZ0JLLEksRUFBTTtBQUNwQixVQUFJQSxTQUFTLEtBQUtiLFlBQWxCLEVBQWdDO0FBQzlCLGFBQUtBLFlBQUwsR0FBb0JhLElBQXBCO0FBQ0EsYUFBS1osU0FBTCxDQUFlYSxlQUFmLENBQStCRCxJQUEvQjtBQUNEO0FBQ0Y7O0FBR0Q7Ozs7Ozs7Ozs7Ozs7b0NBVWdCRSxHLEVBQUs7QUFBQTs7QUFDbkIsVUFBSSxLQUFLWixTQUFULEVBQW9CYSxPQUFPQyxZQUFQLENBQW9CLEtBQUtkLFNBQXpCO0FBQ3BCLFdBQUtBLFNBQUwsR0FBaUJhLE9BQU9FLFVBQVAsQ0FBa0IsWUFBTTtBQUN2QyxjQUFLZixTQUFMLEdBQWlCLENBQWpCO0FBQ0EsWUFBTWdCLFVBQVUsQ0FBQ0MsUUFBUSxNQUFLWixLQUFMLENBQVdhLEtBQW5CLENBQWpCO0FBQ0EsY0FBS0MsSUFBTCxDQUFVSCxVQUFVdkIsUUFBVixHQUFxQkYsT0FBL0I7QUFDRCxPQUpnQixFQUlkLEVBSmMsQ0FBakI7QUFLRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7bUNBV2VxQixHLEVBQUs7QUFDbEIsVUFBSSxDQUFDLENBQUQsRUFBSSxFQUFKLEVBQVEsRUFBUixFQUFZUSxPQUFaLENBQW9CUixJQUFJUyxPQUF4QixNQUFxQyxDQUFDLENBQTFDLEVBQTZDLEtBQUtwQixlQUFMO0FBQzlDOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7eUJBa0JLcUIsSyxFQUFPO0FBQ1YsV0FBS3hCLFNBQUwsQ0FBZXlCLFFBQWYsQ0FBd0JELEtBQXhCO0FBQ0Q7Ozs7OztBQUdIRSxPQUFPQyxPQUFQLEdBQWlCL0IsY0FBakIiLCJmaWxlIjoidHlwaW5nLWxpc3RlbmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHlwaW5nUHVibGlzaGVyID0gcmVxdWlyZSgnLi90eXBpbmctcHVibGlzaGVyJyk7XG5jb25zdCB7U1RBUlRFRCwgUEFVU0VELCBGSU5JU0hFRH0gPSByZXF1aXJlKCcuL3R5cGluZy1pbmRpY2F0b3JzJyk7XG5cbi8qKlxuICogVGhlIFR5cGluZyBMaXN0ZW5lciBDbGFzcyBsaXN0ZW5zIHRvIGtleWJvYXJkIGV2ZW50cyBvblxuICogeW91ciB0ZXh0IGZpZWxkLCBhbmQgdXNlcyB0aGUgbGF5ZXIuVHlwaW5nUHVibGlzaGVyIHRvXG4gKiBzZW5kIHN0YXRlIGJhc2VkIG9uIGtleWJvYXJkIGJlaGF2aW9yLlxuICpcbiAqICAgICAgdmFyIHR5cGluZ0xpc3RlbmVyID0gY2xpZW50LmNyZWF0ZVR5cGluZ0xpc3RlbmVyKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdteXRleHRhcmVhJykpO1xuICpcbiAqICBZb3UgY2hhbmdlIHdoYXQgQ29udmVyc2F0aW9uXG4gKiAgdGhlIHR5cGluZyBpbmRpY2F0b3IgcmVwb3J0cyB5b3VyIHVzZXIgdG8gYmUgdHlwaW5nXG4gKiAgaW4gYnkgY2FsbGluZzpcbiAqXG4gKiAgICAgIHR5cGluZ0xpc3RlbmVyLnNldENvbnZlcnNhdGlvbihteVNlbGVjdGVkQ29udmVyc2F0aW9uKTtcbiAqXG4gKiBUaGVyZSBhcmUgdHdvIHdheXMgb2YgY2xlYW5pbmcgdXAgYWxsIHBvaW50ZXJzIHRvIHlvdXIgaW5wdXQgc28gaXQgY2FuIGJlIGdhcmJhZ2UgY29sbGVjdGVkOlxuICpcbiAqIDEuIERlc3Ryb3kgdGhlIGxpc3RlbmVyOlxuICpcbiAqICAgICAgICB0eXBpbmdMaXN0ZW5lci5kZXN0cm95KCk7XG4gKlxuICogMi4gUmVtb3ZlIG9yIHJlcGxhY2UgdGhlIGlucHV0OlxuICpcbiAqICAgICAgICB0eXBpbmdMaXN0ZW5lci5zZXRJbnB1dChudWxsKTtcbiAqICAgICAgICB0eXBpbmdMaXN0ZW5lci5zZXRJbnB1dChuZXdJbnB1dCk7XG4gKlxuICogQGNsYXNzICBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyXG4gKi9cbmNsYXNzIFR5cGluZ0xpc3RlbmVyIHtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgVHlwaW5nTGlzdGVuZXIgdGhhdCBsaXN0ZW5zIGZvciB0aGUgdXNlcidzIHR5cGluZy5cbiAgICpcbiAgICogVGhlIFR5cGluZ0xpc3RlbmVyIG5lZWRzXG4gICAqIHRvIGtub3cgd2hhdCBDb252ZXJzYXRpb24gdGhlIHVzZXIgaXMgdHlwaW5nIGludG8uLi4gYnV0IGl0IGRvZXMgbm90IHJlcXVpcmUgdGhhdCBwYXJhbWV0ZXIgZHVyaW5nIGluaXRpYWxpemF0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gYXJnc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gYXJncy5jbGllbnRJZCAtIFRoZSBJRCBvZiB0aGUgY2xpZW50OyB1c2VkIHNvIHRoYXQgdGhlIFR5cGluZ1B1Ymxpc2hlciBjYW4gYWNjZXNzIGl0cyB3ZWJzb2NrZXQgbWFuYWdlcipcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW2FyZ3MuaW5wdXQ9bnVsbF0gLSBBIFRleHQgZWRpdG9yIGRvbSBub2RlIHRoYXQgd2lsbCBoYXZlIHR5cGluZyBpbmRpY2F0b3JzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbYXJncy5jb252ZXJzYXRpb249bnVsbF0gLSBUaGUgQ29udmVyc2F0aW9uIE9iamVjdCBvciBJbnN0YW5jZSB0aGF0IHRoZSBpbnB1dCB3aWxsIHNlbmQgbWVzc2FnZXMgdG9cbiAgICovXG4gIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICB0aGlzLmNsaWVudElkID0gYXJncy5jbGllbnRJZDtcbiAgICB0aGlzLmNvbnZlcnNhdGlvbiA9IGFyZ3MuY29udmVyc2F0aW9uO1xuICAgIHRoaXMucHVibGlzaGVyID0gbmV3IFR5cGluZ1B1Ymxpc2hlcih7XG4gICAgICBjbGllbnRJZDogdGhpcy5jbGllbnRJZCxcbiAgICAgIGNvbnZlcnNhdGlvbjogdGhpcy5jb252ZXJzYXRpb24sXG4gICAgfSk7XG5cbiAgICB0aGlzLmludGVydmFsSWQgPSAwO1xuICAgIHRoaXMubGFzdEtleUlkID0gMDtcblxuICAgIHRoaXMuX2hhbmRsZUtleVByZXNzID0gdGhpcy5faGFuZGxlS2V5UHJlc3MuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9oYW5kbGVLZXlEb3duID0gdGhpcy5faGFuZGxlS2V5RG93bi5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc2V0SW5wdXQoYXJncy5pbnB1dCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuX3JlbW92ZUlucHV0KHRoaXMuaW5wdXQpO1xuICAgIHRoaXMucHVibGlzaGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgdGhlIGlucHV0IGJlaW5nIHRyYWNrZWQgYnkgeW91ciBUeXBpbmdMaXN0ZW5lci5cbiAgICpcbiAgICogSWYgeW91IGFyZSByZW1vdmluZyB5b3VyIGlucHV0IGZyb20gdGhlIERPTSwgeW91IGNhbiBzaW1wbHkgY2FsbFxuICAgKlxuICAgKiAgICAgdHlwaW5nTGlzdGVuZXIuc2V0SW5wdXQobnVsbCk7XG4gICAqXG4gICAqIEFuZCBhbGwgZXZlbnQgaGFuZGxlcnMgd2lsbCBiZSByZW1vdmVkLCBhbGxvd2luZyBmb3IgZ2FyYmFnZSBjb2xsZWN0aW9uXG4gICAqIHRvIGNsZWFudXAgeW91ciBpbnB1dC5cbiAgICpcbiAgICogWW91IGNhbiBhbHNvIGNhbGwgc2V0SW5wdXQgd2l0aCBhIG5ld2x5IGNyZWF0ZWQgaW5wdXQ6XG4gICAqXG4gICAqICAgICB2YXIgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgKiAgICAgdHlwaW5nTGlzdGVuZXIuc2V0SW5wdXQoaW5wdXQpO1xuICAgKlxuICAgKiBAbWV0aG9kIHNldElucHV0XG4gICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGlucHV0IC0gVGV4dGFyZWEgb3IgdGV4dCBpbnB1dFxuICAgKi9cbiAgc2V0SW5wdXQoaW5wdXQpIHtcbiAgICBpZiAoaW5wdXQgIT09IHRoaXMuaW5wdXQpIHtcbiAgICAgIHRoaXMuX3JlbW92ZUlucHV0KHRoaXMuaW5wdXQpO1xuICAgICAgdGhpcy5pbnB1dCA9IGlucHV0O1xuXG4gICAgICAvLyBVc2Uga2V5cHJlc3MgcmF0aGVyIHRoYW4ga2V5ZG93biBiZWNhdXNlIHRoZSB1c2VyIGhpdHRpbmcgYWx0LXRhYiB0byBjaGFuZ2VcbiAgICAgIC8vIHdpbmRvd3MsIGFuZCBvdGhlciBtZXRhIGtleXMgc2hvdWxkIG5vdCByZXN1bHQgaW4gdHlwaW5nIGluZGljYXRvcnNcbiAgICAgIHRoaXMuaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCB0aGlzLl9oYW5kbGVLZXlQcmVzcyk7XG4gICAgICB0aGlzLmlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLl9oYW5kbGVLZXlEb3duKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2xlYW51cCBhbmQgcmVtb3ZlIGFsbCBsaW5rcyBhbmQgY2FsbGJhY2tzIGtlZXBpbmcgaW5wdXQgZnJvbSBiZWluZyBnYXJiYWdlIGNvbGxlY3RlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVtb3ZlSW5wdXRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5wdXQgLSBUZXh0YXJlYSBvciB0ZXh0IGlucHV0XG4gICAqL1xuICBfcmVtb3ZlSW5wdXQoaW5wdXQpIHtcbiAgICBpZiAoaW5wdXQpIHtcbiAgICAgIGlucHV0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgdGhpcy5faGFuZGxlS2V5UHJlc3MpO1xuICAgICAgaW5wdXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuX2hhbmRsZUtleURvd24pO1xuICAgICAgdGhpcy5pbnB1dCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSB0aGUgQ29udmVyc2F0aW9uOyB0aGlzIHNob3VsZCBzZXQgdGhlIHN0YXRlIG9mIHRoZSBvbGQgQ29udmVyc2F0aW9uIHRvIFwiZmluaXNoZWRcIi5cbiAgICpcbiAgICogVXNlIHRoaXMgd2hlbiB0aGUgdXNlciBoYXMgY2hhbmdlZCBDb252ZXJzYXRpb25zIGFuZCB5b3Ugd2FudCB0byByZXBvcnQgb24gdHlwaW5nIHRvIGEgbmV3XG4gICAqIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBzZXRDb252ZXJzYXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb252IC0gVGhlIG5ldyBDb252ZXJzYXRpb24gT2JqZWN0IG9yIEluc3RhbmNlXG4gICAqL1xuICBzZXRDb252ZXJzYXRpb24oY29udikge1xuICAgIGlmIChjb252ICE9PSB0aGlzLmNvbnZlcnNhdGlvbikge1xuICAgICAgdGhpcy5jb252ZXJzYXRpb24gPSBjb252O1xuICAgICAgdGhpcy5wdWJsaXNoZXIuc2V0Q29udmVyc2F0aW9uKGNvbnYpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFdoZW5ldmVyIHRoZSBrZXkgaXMgcHJlc3NlZCwgc2VuZCBhIFwic3RhcnRlZFwiIG9yIFwiZmluaXNoZWRcIiBldmVudC5cbiAgICpcbiAgICogSWYgaXRzIGEgXCJzdGFydFwiIGV2ZW50LCBzY2hlZHVsZSBhIHBhdXNlLXRlc3QgdGhhdCB3aWxsIHNlbmRcbiAgICogYSBcInBhdXNlXCIgZXZlbnQgaWYgdHlwaW5nIHN0b3BzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVLZXlQcmVzc1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtLZXlib2FyZEV2ZW50fSBldnRcbiAgICovXG4gIF9oYW5kbGVLZXlQcmVzcyhldnQpIHtcbiAgICBpZiAodGhpcy5sYXN0S2V5SWQpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5sYXN0S2V5SWQpO1xuICAgIHRoaXMubGFzdEtleUlkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5sYXN0S2V5SWQgPSAwO1xuICAgICAgY29uc3QgaXNFbXB0eSA9ICFCb29sZWFuKHRoaXMuaW5wdXQudmFsdWUpO1xuICAgICAgdGhpcy5zZW5kKGlzRW1wdHkgPyBGSU5JU0hFRCA6IFNUQVJURUQpO1xuICAgIH0sIDUwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGtleWJvYXJkIGtleXMgbm90IHJlcG9ydGVkIGJ5IG9uIGJ5IGtleXByZXNzIGV2ZW50cy5cbiAgICpcbiAgICogVGhlc2Uga2V5cyBjYW4gYmUgZGV0ZWN0ZWQgd2l0aCBrZXlEb3duIGV2ZW50IGhhbmRsZXJzLiBUaGUgb25lc1xuICAgKiBjdXJyZW50bHkgaGFuZGxlZCBoZXJlIGFyZSBiYWNrc3BhY2UsIGRlbGV0ZSBhbmQgZW50ZXIuXG4gICAqIFdlIG1heSBhZGQgbW9yZSBsYXRlci5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlS2V5RG93blxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtLZXlib2FyZEV2ZW50fSBldnRcbiAgICovXG4gIF9oYW5kbGVLZXlEb3duKGV2dCkge1xuICAgIGlmIChbOCwgNDYsIDEzXS5pbmRleE9mKGV2dC5rZXlDb2RlKSAhPT0gLTEpIHRoaXMuX2hhbmRsZUtleVByZXNzKCk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCB0aGUgc3RhdGUgdG8gdGhlIHB1Ymxpc2hlci5cbiAgICpcbiAgICogSWYgeW91ciBhcHBsaWNhdGlvbiByZXF1aXJlc1xuICAgKiB5b3UgdG8gZGlyZWN0bHkgY29udHJvbCB0aGUgc3RhdGUsIHlvdSBjYW4gY2FsbCB0aGlzIG1ldGhvZDtcbiAgICogaG93ZXZlciwgYXMgbG9uZyBhcyB5b3UgdXNlIHRoaXMgVHlwaW5nTGlzdGVuZXIsIGtleWJvYXJkXG4gICAqIGV2ZW50cyB3aWxsIG92ZXJ3cml0ZSBhbnkgc3RhdGUgY2hhbmdlcyB5b3Ugc2VuZC5cbiAgICpcbiAgICogQ29tbW9uIHVzZSBjYXNlIGZvciB0aGlzOiBBZnRlciBhIG1lc3NhZ2UgaXMgc2VudCwgeW91IHdhbnQgdG8gY2xlYXIgYW55IHR5cGluZyBpbmRpY2F0b3JzOlxuICAgKlxuICAgKiAgICAgIGZ1bmN0aW9uIHNlbmQoKSB7XG4gICAqICAgICAgICBtZXNzYWdlLnNlbmQoKTtcbiAgICogICAgICAgIHR5cGluZ0luZGljYXRvcnMuc2VuZChsYXllci5UeXBpbmdJbmRpY2F0b3JzLkZJTklTSEVEKTtcbiAgICogICAgICB9XG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHN0YXRlIC0gT25lIG9mIFwic3RhcnRlZFwiLCBcInBhdXNlZFwiLCBcImZpbmlzaGVkXCJcbiAgICovXG4gIHNlbmQoc3RhdGUpIHtcbiAgICB0aGlzLnB1Ymxpc2hlci5zZXRTdGF0ZShzdGF0ZSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBUeXBpbmdMaXN0ZW5lcjtcbiJdfQ==
