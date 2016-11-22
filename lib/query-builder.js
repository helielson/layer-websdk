'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Query = require('./query');
var LayerError = require('./layer-error');

/**
 * Query builder class generating queries for a set of messages.
 * Used in Creating and Updating layer.Query instances.
 *
 * Using the Query Builder, we should be able to instantiate a Query
 *
 *      var qBuilder = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.MessagesQuery
 */

var MessagesQuery = function () {

  /**
   * Creates a new query builder for a set of messages.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function MessagesQuery(query) {
    _classCallCheck(this, MessagesQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow
      };
    } else {
      this._query = {
        model: Query.Message,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow
      };
    }

    // TODO remove when messages can be fetched via query API rather than `GET /messages`
    this._conversationIdSet = false;
  }

  /**
   * Query for messages in this Conversation.
   *
   * @method forConversation
   * @param  {String} conversationId
   */


  _createClass(MessagesQuery, [{
    key: 'forConversation',
    value: function forConversation(conversationId) {
      if (conversationId) {
        this._query.predicate = 'conversation.id = \'' + conversationId + '\'';
        this._conversationIdSet = true;
      } else {
        this._query.predicate = '';
        this._conversationIdSet = false;
      }
      return this;
    }

    /**
     * Sets the pagination window/number of messages to fetch from the local cache or server.
     *
     * Currently only positive integers are supported.
     *
     * @method paginationWindow
     * @param  {number} win
     */

  }, {
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return MessagesQuery;
}();

/**
 * Query builder class generating queries for a set of Announcements.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .announcements()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.AnnouncementsQuery
 * @extends layer.QueryBuilder.MessagesQuery
 */


var AnnouncementsQuery = function (_MessagesQuery) {
  _inherits(AnnouncementsQuery, _MessagesQuery);

  function AnnouncementsQuery(options) {
    _classCallCheck(this, AnnouncementsQuery);

    var _this = _possibleConstructorReturn(this, (AnnouncementsQuery.__proto__ || Object.getPrototypeOf(AnnouncementsQuery)).call(this, options));

    _this._query.model = Query.Announcement;
    return _this;
  }

  _createClass(AnnouncementsQuery, [{
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return AnnouncementsQuery;
}(MessagesQuery);

/**
 * Query builder class generating queries for a set of Conversations.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .conversations()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .conversations()
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.ConversationsQuery
 */


var ConversationsQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function ConversationsQuery(query) {
    _classCallCheck(this, ConversationsQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: query.sortBy
      };
    } else {
      this._query = {
        model: Query.Conversation,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(ConversationsQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Sets the sorting options for the Conversation.
     *
     * Currently only supports descending order
     * Currently only supports fieldNames of "createdAt" and "lastMessage.sentAt"
     *
     * @method sortBy
     * @param  {string} fieldName  - field to sort by
     * @param  {boolean} asc - Is an ascending sort?
     * @return {layer.QueryBuilder} this
     */

  }, {
    key: 'sortBy',
    value: function sortBy(fieldName) {
      var asc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      this._query.sortBy = [_defineProperty({}, fieldName, asc ? 'asc' : 'desc')];
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return ConversationsQuery;
}();

/**
 * Query builder class generating queries for a set of Identities followed by this user.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .identities()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.IdentitiesQuery
 */


var IdentitiesQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function IdentitiesQuery(query) {
    _classCallCheck(this, IdentitiesQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow
      };
    } else {
      this._query = {
        model: Query.Identity,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(IdentitiesQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return IdentitiesQuery;
}();

/**
 * Query builder class. Used with layer.Query to specify what local/remote
 * data changes to subscribe to.  For examples, see layer.QueryBuilder.MessagesQuery
 * and layer.QueryBuilder.ConversationsQuery.  This static class is used to instantiate
 * MessagesQuery and ConversationsQuery Builder instances:
 *
 *      var conversationsQueryBuilder = QueryBuilder.conversations();
 *      var messagesQueryBuidler = QueryBuilder.messages();
 *
 * Should you use these instead of directly using the layer.Query class?
 * That is a matter of programming style and preference, there is no
 * correct answer.
 *
 * @class layer.QueryBuilder
 */


var QueryBuilder = {

  /**
   * Create a new layer.MessagesQuery instance.
   *
   * @method messages
   * @static
   * @returns {layer.QueryBuilder.MessagesQuery}
   */
  messages: function messages() {
    return new MessagesQuery();
  },


  /**
   * Create a new layer.AnnouncementsQuery instance.
   *
   * @method announcements
   * @returns {layer.QueryBuilder.AnnouncementsQuery}
   */
  announcements: function announcements() {
    return new AnnouncementsQuery();
  },


  /**
   * Create a new layer.ConversationsQuery instance.
   *
   * @method conversations
   * @static
   * @returns {layer.QueryBuilder.ConversationsQuery}
   */
  conversations: function conversations() {
    return new ConversationsQuery();
  },


  /**
   * Create a new layer.IdentitiesQuery instance.
   *
   * @method identities
   * @returns {layer.QueryBuilder.IdentitiesQuery}
   */
  identities: function identities() {
    return new IdentitiesQuery();
  },


  /**
   * Takes the return value of QueryBuilder.prototype.build and creates a
   * new QueryBuilder.
   *
   * Used within layer.Query.prototype.toBuilder.
   *
   * @method fromQueryObject
   * @private
   * @param {Object} obj
   * @static
   */
  fromQueryObject: function fromQueryObject(obj) {
    switch (obj.model) {
      case Query.Message:
        return new MessagesQuery(obj);
      case Query.Announcement:
        return new AnnouncementsQuery(obj);
      case Query.Conversation:
        return new ConversationsQuery(obj);
      case Query.Identity:
        return new IdentitiesQuery(obj);
      default:
        return null;
    }
  }
};

module.exports = QueryBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9xdWVyeS1idWlsZGVyLmpzIl0sIm5hbWVzIjpbIlF1ZXJ5IiwicmVxdWlyZSIsIkxheWVyRXJyb3IiLCJNZXNzYWdlc1F1ZXJ5IiwicXVlcnkiLCJfcXVlcnkiLCJtb2RlbCIsInJldHVyblR5cGUiLCJkYXRhVHlwZSIsInBhZ2luYXRpb25XaW5kb3ciLCJNZXNzYWdlIiwicHJvdG90eXBlIiwiX2NvbnZlcnNhdGlvbklkU2V0IiwiY29udmVyc2F0aW9uSWQiLCJwcmVkaWNhdGUiLCJ3aW4iLCJBbm5vdW5jZW1lbnRzUXVlcnkiLCJvcHRpb25zIiwiQW5ub3VuY2VtZW50IiwiQ29udmVyc2F0aW9uc1F1ZXJ5Iiwic29ydEJ5IiwiQ29udmVyc2F0aW9uIiwiZmllbGROYW1lIiwiYXNjIiwiSWRlbnRpdGllc1F1ZXJ5IiwiSWRlbnRpdHkiLCJRdWVyeUJ1aWxkZXIiLCJtZXNzYWdlcyIsImFubm91bmNlbWVudHMiLCJjb252ZXJzYXRpb25zIiwiaWRlbnRpdGllcyIsImZyb21RdWVyeU9iamVjdCIsIm9iaiIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLElBQU1BLFFBQVFDLFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBTUMsYUFBYUQsUUFBUSxlQUFSLENBQW5COztBQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUF1Qk1FLGE7O0FBRUo7Ozs7Ozs7O0FBUUEseUJBQVlDLEtBQVosRUFBbUI7QUFBQTs7QUFDakIsUUFBSUEsS0FBSixFQUFXO0FBQ1QsV0FBS0MsTUFBTCxHQUFjO0FBQ1pDLGVBQU9GLE1BQU1FLEtBREQ7QUFFWkMsb0JBQVlILE1BQU1HLFVBRk47QUFHWkMsa0JBQVVKLE1BQU1JLFFBSEo7QUFJWkMsMEJBQWtCTCxNQUFNSztBQUpaLE9BQWQ7QUFNRCxLQVBELE1BT087QUFDTCxXQUFLSixNQUFMLEdBQWM7QUFDWkMsZUFBT04sTUFBTVUsT0FERDtBQUVaSCxvQkFBWSxRQUZBO0FBR1pD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TUFBTCxDQUFZSSxnQkFBWixHQUErQk0sR0FBL0I7QUFDQSxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs0QkFPUTtBQUNOLGFBQU8sS0FBS1YsTUFBWjtBQUNEOzs7Ozs7QUFHSDs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFlQSxJQUFNcUIsZUFBZTs7QUFFbkI7Ozs7Ozs7QUFPQUMsVUFUbUIsc0JBU1I7QUFDVCxXQUFPLElBQUl4QixhQUFKLEVBQVA7QUFDRCxHQVhrQjs7O0FBYW5COzs7Ozs7QUFNQXlCLGVBbkJtQiwyQkFtQkg7QUFDZCxXQUFPLElBQUlaLGtCQUFKLEVBQVA7QUFDRCxHQXJCa0I7OztBQXVCbkI7Ozs7Ozs7QUFPQWEsZUE5Qm1CLDJCQThCSDtBQUNkLFdBQU8sSUFBSVYsa0JBQUosRUFBUDtBQUNELEdBaENrQjs7O0FBa0NuQjs7Ozs7O0FBTUFXLFlBeENtQix3QkF3Q047QUFDWCxXQUFPLElBQUlOLGVBQUosRUFBUDtBQUNELEdBMUNrQjs7O0FBNENuQjs7Ozs7Ozs7Ozs7QUFXQU8saUJBdkRtQiwyQkF1REhDLEdBdkRHLEVBdURFO0FBQ25CLFlBQVFBLElBQUkxQixLQUFaO0FBQ0UsV0FBS04sTUFBTVUsT0FBWDtBQUNFLGVBQU8sSUFBSVAsYUFBSixDQUFrQjZCLEdBQWxCLENBQVA7QUFDRixXQUFLaEMsTUFBTWtCLFlBQVg7QUFDRSxlQUFPLElBQUlGLGtCQUFKLENBQXVCZ0IsR0FBdkIsQ0FBUDtBQUNGLFdBQUtoQyxNQUFNcUIsWUFBWDtBQUNFLGVBQU8sSUFBSUYsa0JBQUosQ0FBdUJhLEdBQXZCLENBQVA7QUFDRixXQUFLaEMsTUFBTXlCLFFBQVg7QUFDRSxlQUFPLElBQUlELGVBQUosQ0FBb0JRLEdBQXBCLENBQVA7QUFDRjtBQUNFLGVBQU8sSUFBUDtBQVZKO0FBWUQ7QUFwRWtCLENBQXJCOztBQXVFQUMsT0FBT0MsT0FBUCxHQUFpQlIsWUFBakIiLCJmaWxlIjoicXVlcnktYnVpbGRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzIGdlbmVyYXRpbmcgcXVlcmllcyBmb3IgYSBzZXQgb2YgbWVzc2FnZXMuXG4gKiBVc2VkIGluIENyZWF0aW5nIGFuZCBVcGRhdGluZyBsYXllci5RdWVyeSBpbnN0YW5jZXMuXG4gKlxuICogVXNpbmcgdGhlIFF1ZXJ5IEJ1aWxkZXIsIHdlIHNob3VsZCBiZSBhYmxlIHRvIGluc3RhbnRpYXRlIGEgUXVlcnlcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlciA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLm1lc3NhZ2VzKClcbiAqICAgICAgIC5mb3JDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJylcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDEwMCk7XG4gKiAgICAgIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeShxQnVpbGRlcik7XG4gKlxuICpcbiAqIFlvdSBjYW4gdGhlbiBjcmVhdGUgYWRkaXRpb25hbCBidWlsZGVycyBhbmQgdXBkYXRlIHRoZSBxdWVyeTpcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlcjIgPSBRdWVyeUJ1aWxkZXJcbiAqICAgICAgIC5tZXNzYWdlcygpXG4gKiAgICAgICAuZm9yQ29udmVyc2F0aW9uKCdsYXllcjovLy9jb252ZXJzYXRpb25zL2JiYmJiYmJiLWJiYmItYmJiYi1iYmJiLWJiYmJiYmJiYmJiYicpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygyMDApO1xuICogICAgICBxdWVyeS51cGRhdGUocUJ1aWxkZXIpO1xuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXIuTWVzc2FnZXNRdWVyeVxuICovXG5jbGFzcyBNZXNzYWdlc1F1ZXJ5IHtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBxdWVyeSBidWlsZGVyIGZvciBhIHNldCBvZiBtZXNzYWdlcy5cbiAgICpcbiAgICogU3RhbmRhcmQgdXNlIGlzIHdpdGhvdXQgYW55IGFyZ3VtZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtxdWVyeT1udWxsXVxuICAgKi9cbiAgY29uc3RydWN0b3IocXVlcnkpIHtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogcXVlcnkubW9kZWwsXG4gICAgICAgIHJldHVyblR5cGU6IHF1ZXJ5LnJldHVyblR5cGUsXG4gICAgICAgIGRhdGFUeXBlOiBxdWVyeS5kYXRhVHlwZSxcbiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogcXVlcnkucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogUXVlcnkuTWVzc2FnZSxcbiAgICAgICAgcmV0dXJuVHlwZTogJ29iamVjdCcsXG4gICAgICAgIGRhdGFUeXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogUXVlcnkucHJvdG90eXBlLnBhZ2luYXRpb25XaW5kb3csXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIFRPRE8gcmVtb3ZlIHdoZW4gbWVzc2FnZXMgY2FuIGJlIGZldGNoZWQgdmlhIHF1ZXJ5IEFQSSByYXRoZXIgdGhhbiBgR0VUIC9tZXNzYWdlc2BcbiAgICB0aGlzLl9jb252ZXJzYXRpb25JZFNldCA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFF1ZXJ5IGZvciBtZXNzYWdlcyBpbiB0aGlzIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBmb3JDb252ZXJzYXRpb25cbiAgICogQHBhcmFtICB7U3RyaW5nfSBjb252ZXJzYXRpb25JZFxuICAgKi9cbiAgZm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgaWYgKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgICB0aGlzLl9xdWVyeS5wcmVkaWNhdGUgPSBgY29udmVyc2F0aW9uLmlkID0gJyR7Y29udmVyc2F0aW9uSWR9J2A7XG4gICAgICB0aGlzLl9jb252ZXJzYXRpb25JZFNldCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3F1ZXJ5LnByZWRpY2F0ZSA9ICcnO1xuICAgICAgdGhpcy5fY29udmVyc2F0aW9uSWRTZXQgPSBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgcGFnaW5hdGlvbiB3aW5kb3cvbnVtYmVyIG9mIG1lc3NhZ2VzIHRvIGZldGNoIGZyb20gdGhlIGxvY2FsIGNhY2hlIG9yIHNlcnZlci5cbiAgICpcbiAgICogQ3VycmVudGx5IG9ubHkgcG9zaXRpdmUgaW50ZWdlcnMgYXJlIHN1cHBvcnRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBwYWdpbmF0aW9uV2luZG93XG4gICAqIEBwYXJhbSAge251bWJlcn0gd2luXG4gICAqL1xuICBwYWdpbmF0aW9uV2luZG93KHdpbikge1xuICAgIHRoaXMuX3F1ZXJ5LnBhZ2luYXRpb25XaW5kb3cgPSB3aW47XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYnVpbHQgcXVlcnkgb2JqZWN0IHRvIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGJ5IGxheWVyLlF1ZXJ5QnVpbGRlci4gWW91IHNob3VsZCBub3QgbmVlZCB0byBjYWxsIHRoaXMuXG4gICAqXG4gICAqIEBtZXRob2QgYnVpbGRcbiAgICovXG4gIGJ1aWxkKCkge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeTtcbiAgfVxufVxuXG4vKipcbiAqIFF1ZXJ5IGJ1aWxkZXIgY2xhc3MgZ2VuZXJhdGluZyBxdWVyaWVzIGZvciBhIHNldCBvZiBBbm5vdW5jZW1lbnRzLlxuICpcbiAqIFRvIGdldCBzdGFydGVkOlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuYW5ub3VuY2VtZW50cygpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygxMDApO1xuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocUJ1aWxkZXIpO1xuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXIuQW5ub3VuY2VtZW50c1F1ZXJ5XG4gKiBAZXh0ZW5kcyBsYXllci5RdWVyeUJ1aWxkZXIuTWVzc2FnZXNRdWVyeVxuICovXG5jbGFzcyBBbm5vdW5jZW1lbnRzUXVlcnkgZXh0ZW5kcyBNZXNzYWdlc1F1ZXJ5IHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX3F1ZXJ5Lm1vZGVsID0gUXVlcnkuQW5ub3VuY2VtZW50O1xuICB9XG4gIGJ1aWxkKCkge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeTtcbiAgfVxufVxuXG4vKipcbiAqIFF1ZXJ5IGJ1aWxkZXIgY2xhc3MgZ2VuZXJhdGluZyBxdWVyaWVzIGZvciBhIHNldCBvZiBDb252ZXJzYXRpb25zLlxuICpcbiAqIFVzZWQgaW4gQ3JlYXRpbmcgYW5kIFVwZGF0aW5nIGxheWVyLlF1ZXJ5IGluc3RhbmNlcy5cbiAqXG4gKiBUbyBnZXQgc3RhcnRlZDpcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlciA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLmNvbnZlcnNhdGlvbnMoKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAqXG4gKiBZb3UgY2FuIHRoZW4gY3JlYXRlIGFkZGl0aW9uYWwgYnVpbGRlcnMgYW5kIHVwZGF0ZSB0aGUgcXVlcnk6XG4gKlxuICogICAgICB2YXIgcUJ1aWxkZXIyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuY29udmVyc2F0aW9ucygpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygyMDApO1xuICogICAgICBxdWVyeS51cGRhdGUocUJ1aWxkZXIpO1xuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXIuQ29udmVyc2F0aW9uc1F1ZXJ5XG4gKi9cbmNsYXNzIENvbnZlcnNhdGlvbnNRdWVyeSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgcXVlcnkgYnVpbGRlciBmb3IgYSBzZXQgb2YgY29udmVyc2F0aW9ucy5cbiAgICpcbiAgICogU3RhbmRhcmQgdXNlIGlzIHdpdGhvdXQgYW55IGFyZ3VtZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtxdWVyeT1udWxsXVxuICAgKi9cbiAgY29uc3RydWN0b3IocXVlcnkpIHtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogcXVlcnkubW9kZWwsXG4gICAgICAgIHJldHVyblR5cGU6IHF1ZXJ5LnJldHVyblR5cGUsXG4gICAgICAgIGRhdGFUeXBlOiBxdWVyeS5kYXRhVHlwZSxcbiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogcXVlcnkucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgICAgc29ydEJ5OiBxdWVyeS5zb3J0QnksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9xdWVyeSA9IHtcbiAgICAgICAgbW9kZWw6IFF1ZXJ5LkNvbnZlcnNhdGlvbixcbiAgICAgICAgcmV0dXJuVHlwZTogJ29iamVjdCcsXG4gICAgICAgIGRhdGFUeXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogUXVlcnkucHJvdG90eXBlLnBhZ2luYXRpb25XaW5kb3csXG4gICAgICAgIHNvcnRCeTogbnVsbCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBhZ2luYXRpb24gd2luZG93L251bWJlciBvZiBtZXNzYWdlcyB0byBmZXRjaCBmcm9tIHRoZSBsb2NhbCBjYWNoZSBvciBzZXJ2ZXIuXG4gICAqXG4gICAqIEN1cnJlbnRseSBvbmx5IHBvc2l0aXZlIGludGVnZXJzIGFyZSBzdXBwb3J0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgcGFnaW5hdGlvbldpbmRvd1xuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHdpblxuICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeUJ1aWxkZXJ9IHRoaXNcbiAgICovXG4gIHBhZ2luYXRpb25XaW5kb3cod2luKSB7XG4gICAgdGhpcy5fcXVlcnkucGFnaW5hdGlvbldpbmRvdyA9IHdpbjtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBzb3J0aW5nIG9wdGlvbnMgZm9yIHRoZSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGRlc2NlbmRpbmcgb3JkZXJcbiAgICogQ3VycmVudGx5IG9ubHkgc3VwcG9ydHMgZmllbGROYW1lcyBvZiBcImNyZWF0ZWRBdFwiIGFuZCBcImxhc3RNZXNzYWdlLnNlbnRBdFwiXG4gICAqXG4gICAqIEBtZXRob2Qgc29ydEJ5XG4gICAqIEBwYXJhbSAge3N0cmluZ30gZmllbGROYW1lICAtIGZpZWxkIHRvIHNvcnQgYnlcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gYXNjIC0gSXMgYW4gYXNjZW5kaW5nIHNvcnQ/XG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5QnVpbGRlcn0gdGhpc1xuICAgKi9cbiAgc29ydEJ5KGZpZWxkTmFtZSwgYXNjID0gZmFsc2UpIHtcbiAgICB0aGlzLl9xdWVyeS5zb3J0QnkgPSBbeyBbZmllbGROYW1lXTogYXNjID8gJ2FzYycgOiAnZGVzYycgfV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYnVpbHQgcXVlcnkgb2JqZWN0IHRvIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGJ5IGxheWVyLlF1ZXJ5QnVpbGRlci4gWW91IHNob3VsZCBub3QgbmVlZCB0byBjYWxsIHRoaXMuXG4gICAqXG4gICAqIEBtZXRob2QgYnVpbGRcbiAgICovXG4gIGJ1aWxkKCkge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeTtcbiAgfVxufVxuXG5cbi8qKlxuICogUXVlcnkgYnVpbGRlciBjbGFzcyBnZW5lcmF0aW5nIHF1ZXJpZXMgZm9yIGEgc2V0IG9mIElkZW50aXRpZXMgZm9sbG93ZWQgYnkgdGhpcyB1c2VyLlxuICpcbiAqIFVzZWQgaW4gQ3JlYXRpbmcgYW5kIFVwZGF0aW5nIGxheWVyLlF1ZXJ5IGluc3RhbmNlcy5cbiAqXG4gKiBUbyBnZXQgc3RhcnRlZDpcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlciA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLmlkZW50aXRpZXMoKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuUXVlcnlCdWlsZGVyLklkZW50aXRpZXNRdWVyeVxuICovXG5jbGFzcyBJZGVudGl0aWVzUXVlcnkge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IHF1ZXJ5IGJ1aWxkZXIgZm9yIGEgc2V0IG9mIGNvbnZlcnNhdGlvbnMuXG4gICAqXG4gICAqIFN0YW5kYXJkIHVzZSBpcyB3aXRob3V0IGFueSBhcmd1bWVudHMuXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbcXVlcnk9bnVsbF1cbiAgICovXG4gIGNvbnN0cnVjdG9yKHF1ZXJ5KSB7XG4gICAgaWYgKHF1ZXJ5KSB7XG4gICAgICB0aGlzLl9xdWVyeSA9IHtcbiAgICAgICAgbW9kZWw6IHF1ZXJ5Lm1vZGVsLFxuICAgICAgICByZXR1cm5UeXBlOiBxdWVyeS5yZXR1cm5UeXBlLFxuICAgICAgICBkYXRhVHlwZTogcXVlcnkuZGF0YVR5cGUsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IHF1ZXJ5LnBhZ2luYXRpb25XaW5kb3csXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9xdWVyeSA9IHtcbiAgICAgICAgbW9kZWw6IFF1ZXJ5LklkZW50aXR5LFxuICAgICAgICByZXR1cm5UeXBlOiAnb2JqZWN0JyxcbiAgICAgICAgZGF0YVR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBRdWVyeS5wcm90b3R5cGUucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBhZ2luYXRpb24gd2luZG93L251bWJlciBvZiBtZXNzYWdlcyB0byBmZXRjaCBmcm9tIHRoZSBsb2NhbCBjYWNoZSBvciBzZXJ2ZXIuXG4gICAqXG4gICAqIEN1cnJlbnRseSBvbmx5IHBvc2l0aXZlIGludGVnZXJzIGFyZSBzdXBwb3J0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgcGFnaW5hdGlvbldpbmRvd1xuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHdpblxuICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeUJ1aWxkZXJ9IHRoaXNcbiAgICovXG4gIHBhZ2luYXRpb25XaW5kb3cod2luKSB7XG4gICAgdGhpcy5fcXVlcnkucGFnaW5hdGlvbldpbmRvdyA9IHdpbjtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBidWlsdCBxdWVyeSBvYmplY3QgdG8gc2VuZCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgYnkgbGF5ZXIuUXVlcnlCdWlsZGVyLiBZb3Ugc2hvdWxkIG5vdCBuZWVkIHRvIGNhbGwgdGhpcy5cbiAgICpcbiAgICogQG1ldGhvZCBidWlsZFxuICAgKi9cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5O1xuICB9XG59XG5cbi8qKlxuICogUXVlcnkgYnVpbGRlciBjbGFzcy4gVXNlZCB3aXRoIGxheWVyLlF1ZXJ5IHRvIHNwZWNpZnkgd2hhdCBsb2NhbC9yZW1vdGVcbiAqIGRhdGEgY2hhbmdlcyB0byBzdWJzY3JpYmUgdG8uICBGb3IgZXhhbXBsZXMsIHNlZSBsYXllci5RdWVyeUJ1aWxkZXIuTWVzc2FnZXNRdWVyeVxuICogYW5kIGxheWVyLlF1ZXJ5QnVpbGRlci5Db252ZXJzYXRpb25zUXVlcnkuICBUaGlzIHN0YXRpYyBjbGFzcyBpcyB1c2VkIHRvIGluc3RhbnRpYXRlXG4gKiBNZXNzYWdlc1F1ZXJ5IGFuZCBDb252ZXJzYXRpb25zUXVlcnkgQnVpbGRlciBpbnN0YW5jZXM6XG4gKlxuICogICAgICB2YXIgY29udmVyc2F0aW9uc1F1ZXJ5QnVpbGRlciA9IFF1ZXJ5QnVpbGRlci5jb252ZXJzYXRpb25zKCk7XG4gKiAgICAgIHZhciBtZXNzYWdlc1F1ZXJ5QnVpZGxlciA9IFF1ZXJ5QnVpbGRlci5tZXNzYWdlcygpO1xuICpcbiAqIFNob3VsZCB5b3UgdXNlIHRoZXNlIGluc3RlYWQgb2YgZGlyZWN0bHkgdXNpbmcgdGhlIGxheWVyLlF1ZXJ5IGNsYXNzP1xuICogVGhhdCBpcyBhIG1hdHRlciBvZiBwcm9ncmFtbWluZyBzdHlsZSBhbmQgcHJlZmVyZW5jZSwgdGhlcmUgaXMgbm9cbiAqIGNvcnJlY3QgYW5zd2VyLlxuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXJcbiAqL1xuY29uc3QgUXVlcnlCdWlsZGVyID0ge1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbGF5ZXIuTWVzc2FnZXNRdWVyeSBpbnN0YW5jZS5cbiAgICpcbiAgICogQG1ldGhvZCBtZXNzYWdlc1xuICAgKiBAc3RhdGljXG4gICAqIEByZXR1cm5zIHtsYXllci5RdWVyeUJ1aWxkZXIuTWVzc2FnZXNRdWVyeX1cbiAgICovXG4gIG1lc3NhZ2VzKCkge1xuICAgIHJldHVybiBuZXcgTWVzc2FnZXNRdWVyeSgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbGF5ZXIuQW5ub3VuY2VtZW50c1F1ZXJ5IGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGFubm91bmNlbWVudHNcbiAgICogQHJldHVybnMge2xheWVyLlF1ZXJ5QnVpbGRlci5Bbm5vdW5jZW1lbnRzUXVlcnl9XG4gICAqL1xuICBhbm5vdW5jZW1lbnRzKCkge1xuICAgIHJldHVybiBuZXcgQW5ub3VuY2VtZW50c1F1ZXJ5KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5Db252ZXJzYXRpb25zUXVlcnkgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgY29udmVyc2F0aW9uc1xuICAgKiBAc3RhdGljXG4gICAqIEByZXR1cm5zIHtsYXllci5RdWVyeUJ1aWxkZXIuQ29udmVyc2F0aW9uc1F1ZXJ5fVxuICAgKi9cbiAgY29udmVyc2F0aW9ucygpIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbnNRdWVyeSgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbGF5ZXIuSWRlbnRpdGllc1F1ZXJ5IGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGlkZW50aXRpZXNcbiAgICogQHJldHVybnMge2xheWVyLlF1ZXJ5QnVpbGRlci5JZGVudGl0aWVzUXVlcnl9XG4gICAqL1xuICBpZGVudGl0aWVzKCkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdGllc1F1ZXJ5KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRha2VzIHRoZSByZXR1cm4gdmFsdWUgb2YgUXVlcnlCdWlsZGVyLnByb3RvdHlwZS5idWlsZCBhbmQgY3JlYXRlcyBhXG4gICAqIG5ldyBRdWVyeUJ1aWxkZXIuXG4gICAqXG4gICAqIFVzZWQgd2l0aGluIGxheWVyLlF1ZXJ5LnByb3RvdHlwZS50b0J1aWxkZXIuXG4gICAqXG4gICAqIEBtZXRob2QgZnJvbVF1ZXJ5T2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAgICogQHN0YXRpY1xuICAgKi9cbiAgZnJvbVF1ZXJ5T2JqZWN0KG9iaikge1xuICAgIHN3aXRjaCAob2JqLm1vZGVsKSB7XG4gICAgICBjYXNlIFF1ZXJ5Lk1lc3NhZ2U6XG4gICAgICAgIHJldHVybiBuZXcgTWVzc2FnZXNRdWVyeShvYmopO1xuICAgICAgY2FzZSBRdWVyeS5Bbm5vdW5jZW1lbnQ6XG4gICAgICAgIHJldHVybiBuZXcgQW5ub3VuY2VtZW50c1F1ZXJ5KG9iaik7XG4gICAgICBjYXNlIFF1ZXJ5LkNvbnZlcnNhdGlvbjpcbiAgICAgICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb25zUXVlcnkob2JqKTtcbiAgICAgIGNhc2UgUXVlcnkuSWRlbnRpdHk6XG4gICAgICAgIHJldHVybiBuZXcgSWRlbnRpdGllc1F1ZXJ5KG9iaik7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH0sXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5QnVpbGRlcjtcblxuIl19
