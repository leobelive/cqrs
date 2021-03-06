import thunkify from 'thunkify';
import {EventEmitter} from 'events';

/**
 * cqrs's core component.
 * @class Repository
 * @param Actor {class}
 * @param eventstore {EventStore}
 */
export default
class Repository extends EventEmitter {

    constructor(Actor, eventstore) {
        this.__Actor = Actor;
        this.__getFromSnapShot = thunkify(eventstore.getFromSnapshot).bind(eventstore);
        this.__createSnapshot = thunkify(eventstore.createSnapshot).bind(eventstore);
        this.__cache = {}
    }

    /**
     * Create a Actor object.
     * @method *create
     * @memberof Repository.prototype
     * @param data {Object}
     * @returns {Actor}
     */
    *create(data) {

        let actor = new this.__Actor(data);
        let result = yield this.__getFromSnapShot(actor.id);
        let stream = result[1];

        yield this.__createSnapshot({
            streamId: actor.id,
            data: this.__Actor.toJSON(actor),
            revision: stream.lastRevision
        });

        this.__cache[actor.id] = actor;

        return actor;

    }

    /**
     * clear a actor from cache.
     * @method clear
     * @memberof Repository.prototype
     * @param id
     */
    clear(id) {
        this.__cache[id] = null;
    }

    /**
     * get actor from cache.
     * @memberof Repository.prototype
     * @method getFromCache
     * @param id {String}
     * @returns {Actor}
     */
    getFromCache(id) {
        return this.__cache[id];
    }

    /**
     * get a actor
     * @method *get
     * @memberof Repository.prototype
     * @param id {String}
     * @return {Actor}
     */
    *get(id) {

        let actor,
            returnFun = function () {
                if (actor && actor.isAlive) {
                    return actor;
                } else {
                    return null;
                }
            };

        if (actor = this.getFromCache(id)) {
            return returnFun();
        }


        let result = yield this.__getFromSnapShot(id);
        if (actor = this.getFromCache(id)) {
            return returnFun();
        }

        let snapshot = result[0];
        let stream = result[1];

        if (!snapshot) return;

        let snap = snapshot.data;

        actor = this.__Actor.parse(snap);

        let history = stream.events;

        let historyv = [];

        history.forEach(function (e) {
            historyv.push(e.payload);
        });

        actor.$$loadEvents(historyv);

        this.__cache[actor.id] = actor;

        return returnFun();
    }

    

}
