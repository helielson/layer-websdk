'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class  layer.Websockets.ChangeManager
 * @private
 *
 * This class listens for `change` events from the websocket server,
 * and processes them.
 */
var Utils = require('../client-utils');
var logger = require('../logger');
var Message = require('../message');
var Conversation = require('../conversation');

var WebsocketChangeManager = function () {
  /**
   * Create a new websocket change manager
   *
   *      var websocketChangeManager = new layer.Websockets.ChangeManager({
   *          client: client,
   *          socketManager: client.Websockets.SocketManager
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @param {layer.Websockets.SocketManager} socketManager
   * @returns {layer.Websockets.ChangeManager}
   */
  function WebsocketChangeManager(options) {
    _classCallCheck(this, WebsocketChangeManager);

    this.client = options.client;
    options.socketManager.on('message', this._handleChange, this);
  }

  /**
   * Handles a Change packet from the server.
   *
   * @method _handleChange
   * @private
   * @param  {layer.LayerEvent} evt
   */


  _createClass(WebsocketChangeManager, [{
    key: '_handleChange',
    value: function _handleChange(evt) {
      if (evt.data.type === 'change') {
        var msg = evt.data.body;
        switch (msg.operation) {
          case 'create':
            logger.info('Websocket Change Event: Create ' + msg.object.type + ' ' + msg.object.id);
            logger.debug(msg.data);
            this._handleCreate(msg);
            break;
          case 'delete':
            logger.info('Websocket Change Event: Delete ' + msg.object.type + ' ' + msg.object.id);
            logger.debug(msg.data);
            this._handleDelete(msg);
            break;
          case 'update':
            logger.info('Websocket Change Event: Patch ' + msg.object.type + ' ' + msg.object.id + ': ' + msg.data.map(function (op) {
              return op.property;
            }).join(', '));
            logger.debug(msg.data);
            this._handlePatch(msg);
            break;
        }
      }
    }

    /**
     * Process a create object message from the server
     *
     * @method _handleCreate
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handleCreate',
    value: function _handleCreate(msg) {
      msg.data.fromWebsocket = true;
      this.client._createObject(msg.data);
    }

    /**
     * Handles delete object messages from the server.
     * All objects that can be deleted from the server should
     * provide a _deleted() method to be called prior to destroy().
     *
     * @method _handleDelete
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handleDelete',
    value: function _handleDelete(msg) {
      var entity = this._getObject(msg);
      if (entity) {
        entity._handleWebsocketDelete(msg.data);
      }
    }

    /**
     * On receiving an update/patch message from the server
     * run the LayerParser on the data.
     *
     * @method _handlePatch
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handlePatch',
    value: function _handlePatch(msg) {
      // Can only patch a cached object
      var entity = this._getObject(msg);
      if (entity) {
        try {
          entity._inLayerParser = true;
          Utils.layerParse({
            object: entity,
            type: msg.object.type,
            operations: msg.data,
            client: this.client
          });
          entity._inLayerParser = false;
        } catch (err) {
          logger.error('websocket-manager: Failed to handle event', msg.data);
        }
      } else {
        switch (Utils.typeFromID(msg.object.id)) {
          case 'conversations':
            if (Conversation._loadResourceForPatch(msg.data)) this.client.getConversation(msg.object.id, true);
            break;
          case 'messages':
            if (Message._loadResourceForPatch(msg.data)) this.client.getMessage(msg.object.id, true);
            break;
          case 'announcements':
            break;
        }
      }
    }

    /**
     * Get the object specified by the `object` property of the websocket packet.
     *
     * @method _getObject
     * @private
     * @param  {Object} msg
     * @return {layer.Root}
     */

  }, {
    key: '_getObject',
    value: function _getObject(msg) {
      return this.client._getObject(msg.object.id);
    }

    /**
     * Not required, but destroy is best practice
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      this.client = null;
    }
  }]);

  return WebsocketChangeManager;
}();

/**
 * The Client that owns this.
 * @type {layer.Client}
 */


WebsocketChangeManager.prototype.client = null;

module.exports = WebsocketChangeManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL2NoYW5nZS1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsImxvZ2dlciIsIk1lc3NhZ2UiLCJDb252ZXJzYXRpb24iLCJXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyIiwib3B0aW9ucyIsImNsaWVudCIsInNvY2tldE1hbmFnZXIiLCJvbiIsIl9oYW5kbGVDaGFuZ2UiLCJldnQiLCJkYXRhIiwidHlwZSIsIm1zZyIsImJvZHkiLCJvcGVyYXRpb24iLCJpbmZvIiwib2JqZWN0IiwiaWQiLCJkZWJ1ZyIsIl9oYW5kbGVDcmVhdGUiLCJfaGFuZGxlRGVsZXRlIiwibWFwIiwib3AiLCJwcm9wZXJ0eSIsImpvaW4iLCJfaGFuZGxlUGF0Y2giLCJmcm9tV2Vic29ja2V0IiwiX2NyZWF0ZU9iamVjdCIsImVudGl0eSIsIl9nZXRPYmplY3QiLCJfaGFuZGxlV2Vic29ja2V0RGVsZXRlIiwiX2luTGF5ZXJQYXJzZXIiLCJsYXllclBhcnNlIiwib3BlcmF0aW9ucyIsImVyciIsImVycm9yIiwidHlwZUZyb21JRCIsIl9sb2FkUmVzb3VyY2VGb3JQYXRjaCIsImdldENvbnZlcnNhdGlvbiIsImdldE1lc3NhZ2UiLCJwcm90b3R5cGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7OztBQU9BLElBQU1BLFFBQVFDLFFBQVEsaUJBQVIsQ0FBZDtBQUNBLElBQU1DLFNBQVNELFFBQVEsV0FBUixDQUFmO0FBQ0EsSUFBTUUsVUFBVUYsUUFBUSxZQUFSLENBQWhCO0FBQ0EsSUFBTUcsZUFBZUgsUUFBUSxpQkFBUixDQUFyQjs7SUFHTUksc0I7QUFDSjs7Ozs7Ozs7Ozs7Ozs7QUFjQSxrQ0FBWUMsT0FBWixFQUFxQjtBQUFBOztBQUNuQixTQUFLQyxNQUFMLEdBQWNELFFBQVFDLE1BQXRCO0FBQ0FELFlBQVFFLGFBQVIsQ0FBc0JDLEVBQXRCLENBQXlCLFNBQXpCLEVBQW9DLEtBQUtD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LEVBQXNDLElBQXRDO0FBQzdDO0FBQ0YsZUFBSyxlQUFMO0FBQ0U7QUFSSjtBQVVEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7OytCQVFXTCxHLEVBQUs7QUFDZCxhQUFPLEtBQUtQLE1BQUwsQ0FBWXdCLFVBQVosQ0FBdUJqQixJQUFJSSxNQUFKLENBQVdDLEVBQWxDLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs4QkFJVTtBQUNSLFdBQUtaLE1BQUwsR0FBYyxJQUFkO0FBQ0Q7Ozs7OztBQUdIOzs7Ozs7QUFJQUYsdUJBQXVCcUMsU0FBdkIsQ0FBaUNuQyxNQUFqQyxHQUEwQyxJQUExQzs7QUFFQW9DLE9BQU9DLE9BQVAsR0FBaUJ2QyxzQkFBakIiLCJmaWxlIjoiY2hhbmdlLW1hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyAgbGF5ZXIuV2Vic29ja2V0cy5DaGFuZ2VNYW5hZ2VyXG4gKiBAcHJpdmF0ZVxuICpcbiAqIFRoaXMgY2xhc3MgbGlzdGVucyBmb3IgYGNoYW5nZWAgZXZlbnRzIGZyb20gdGhlIHdlYnNvY2tldCBzZXJ2ZXIsXG4gKiBhbmQgcHJvY2Vzc2VzIHRoZW0uXG4gKi9cbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXInKTtcbmNvbnN0IE1lc3NhZ2UgPSByZXF1aXJlKCcuLi9tZXNzYWdlJyk7XG5jb25zdCBDb252ZXJzYXRpb24gPSByZXF1aXJlKCcuLi9jb252ZXJzYXRpb24nKTtcblxuXG5jbGFzcyBXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyB3ZWJzb2NrZXQgY2hhbmdlIG1hbmFnZXJcbiAgICpcbiAgICogICAgICB2YXIgd2Vic29ja2V0Q2hhbmdlTWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXIoe1xuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICAgICAgc29ja2V0TWFuYWdlcjogY2xpZW50LldlYnNvY2tldHMuU29ja2V0TWFuYWdlclxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfSBzb2NrZXRNYW5hZ2VyXG4gICAqIEByZXR1cm5zIHtsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXJ9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5jbGllbnQgPSBvcHRpb25zLmNsaWVudDtcbiAgICBvcHRpb25zLnNvY2tldE1hbmFnZXIub24oJ21lc3NhZ2UnLCB0aGlzLl9oYW5kbGVDaGFuZ2UsIHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgYSBDaGFuZ2UgcGFja2V0IGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgX2hhbmRsZUNoYW5nZShldnQpIHtcbiAgICBpZiAoZXZ0LmRhdGEudHlwZSA9PT0gJ2NoYW5nZScpIHtcbiAgICAgIGNvbnN0IG1zZyA9IGV2dC5kYXRhLmJvZHk7XG4gICAgICBzd2l0Y2ggKG1zZy5vcGVyYXRpb24pIHtcbiAgICAgICAgY2FzZSAnY3JlYXRlJzpcbiAgICAgICAgICBsb2dnZXIuaW5mbyhgV2Vic29ja2V0IENoYW5nZSBFdmVudDogQ3JlYXRlICR7bXNnLm9iamVjdC50eXBlfSAke21zZy5vYmplY3QuaWR9YCk7XG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKG1zZy5kYXRhKTtcbiAgICAgICAgICB0aGlzLl9oYW5kbGVDcmVhdGUobXNnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBsb2dnZXIuaW5mbyhgV2Vic29ja2V0IENoYW5nZSBFdmVudDogRGVsZXRlICR7bXNnLm9iamVjdC50eXBlfSAke21zZy5vYmplY3QuaWR9YCk7XG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKG1zZy5kYXRhKTtcbiAgICAgICAgICB0aGlzLl9oYW5kbGVEZWxldGUobXNnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgICBsb2dnZXIuaW5mbyhgV2Vic29ja2V0IENoYW5nZSBFdmVudDogUGF0Y2ggJHttc2cub2JqZWN0LnR5cGV9ICR7bXNnLm9iamVjdC5pZH06ICR7bXNnLmRhdGEubWFwKG9wID0+IG9wLnByb3BlcnR5KS5qb2luKCcsICcpfWApO1xuICAgICAgICAgIGxvZ2dlci5kZWJ1Zyhtc2cuZGF0YSk7XG4gICAgICAgICAgdGhpcy5faGFuZGxlUGF0Y2gobXNnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIGNyZWF0ZSBvYmplY3QgbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXJcbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ3JlYXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gbXNnXG4gICAqL1xuICBfaGFuZGxlQ3JlYXRlKG1zZykge1xuICAgIG1zZy5kYXRhLmZyb21XZWJzb2NrZXQgPSB0cnVlO1xuICAgIHRoaXMuY2xpZW50Ll9jcmVhdGVPYmplY3QobXNnLmRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgZGVsZXRlIG9iamVjdCBtZXNzYWdlcyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEFsbCBvYmplY3RzIHRoYXQgY2FuIGJlIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyIHNob3VsZFxuICAgKiBwcm92aWRlIGEgX2RlbGV0ZWQoKSBtZXRob2QgdG8gYmUgY2FsbGVkIHByaW9yIHRvIGRlc3Ryb3koKS5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlRGVsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gbXNnXG4gICAqL1xuICBfaGFuZGxlRGVsZXRlKG1zZykge1xuICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuX2dldE9iamVjdChtc2cpO1xuICAgIGlmIChlbnRpdHkpIHtcbiAgICAgIGVudGl0eS5faGFuZGxlV2Vic29ja2V0RGVsZXRlKG1zZy5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT24gcmVjZWl2aW5nIGFuIHVwZGF0ZS9wYXRjaCBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKiBydW4gdGhlIExheWVyUGFyc2VyIG9uIHRoZSBkYXRhLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVQYXRjaFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1zZ1xuICAgKi9cbiAgX2hhbmRsZVBhdGNoKG1zZykge1xuICAgIC8vIENhbiBvbmx5IHBhdGNoIGEgY2FjaGVkIG9iamVjdFxuICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuX2dldE9iamVjdChtc2cpO1xuICAgIGlmIChlbnRpdHkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGVudGl0eS5faW5MYXllclBhcnNlciA9IHRydWU7XG4gICAgICAgIFV0aWxzLmxheWVyUGFyc2Uoe1xuICAgICAgICAgIG9iamVjdDogZW50aXR5LFxuICAgICAgICAgIHR5cGU6IG1zZy5vYmplY3QudHlwZSxcbiAgICAgICAgICBvcGVyYXRpb25zOiBtc2cuZGF0YSxcbiAgICAgICAgICBjbGllbnQ6IHRoaXMuY2xpZW50LFxuICAgICAgICB9KTtcbiAgICAgICAgZW50aXR5Ll9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKCd3ZWJzb2NrZXQtbWFuYWdlcjogRmFpbGVkIHRvIGhhbmRsZSBldmVudCcsIG1zZy5kYXRhKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3dpdGNoIChVdGlscy50eXBlRnJvbUlEKG1zZy5vYmplY3QuaWQpKSB7XG4gICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICAgIGlmIChDb252ZXJzYXRpb24uX2xvYWRSZXNvdXJjZUZvclBhdGNoKG1zZy5kYXRhKSkgdGhpcy5jbGllbnQuZ2V0Q29udmVyc2F0aW9uKG1zZy5vYmplY3QuaWQsIHRydWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICAgICAgaWYgKE1lc3NhZ2UuX2xvYWRSZXNvdXJjZUZvclBhdGNoKG1zZy5kYXRhKSkgdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShtc2cub2JqZWN0LmlkLCB0cnVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYW5ub3VuY2VtZW50cyc6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgb2JqZWN0IHNwZWNpZmllZCBieSB0aGUgYG9iamVjdGAgcHJvcGVydHkgb2YgdGhlIHdlYnNvY2tldCBwYWNrZXQuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldE9iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1zZ1xuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fVxuICAgKi9cbiAgX2dldE9iamVjdChtc2cpIHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuX2dldE9iamVjdChtc2cub2JqZWN0LmlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3QgcmVxdWlyZWQsIGJ1dCBkZXN0cm95IGlzIGJlc3QgcHJhY3RpY2VcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuY2xpZW50ID0gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBDbGllbnQgdGhhdCBvd25zIHRoaXMuXG4gKiBAdHlwZSB7bGF5ZXIuQ2xpZW50fVxuICovXG5XZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyLnByb3RvdHlwZS5jbGllbnQgPSBudWxsO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYnNvY2tldENoYW5nZU1hbmFnZXI7XG4iXX0=
