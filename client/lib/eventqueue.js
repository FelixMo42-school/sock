export default class EventQueue {
    list = []

    clear() {
        this.list = []
    }

    set(list) {
        this.list = list

        this.triggerCallback()
    }

    add(item) {
        this.list.push(item)

        this.triggerCallback()
    }

    triggerCallback() {
        // we dont have any events queued up for the callback, return
        if (this.list.length == 0) return

        // we dont have a callback to call, return
        if (this.callback == null) return

        // grab the first event and call the callback with it 
        this.callback( this.list.shift() )

        // weve used this callback so remove it
        this.callback = null
    }

    next(callback) {
        if (this.list.length > 0) {
            callback( this.list.shift() )
        } else {
            this.callback = callback
        }
    }
}