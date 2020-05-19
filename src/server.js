const express = require("express")
const barter = require("./barter")
const uuid = require("uuid").v1
const http = require("http")

const wait = ms => new Promise(done => setTimeout(done, ms))

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const objectIncludes = (object, {x, y}) => x >= object.x && x < object.x + object.width && y >= object.y && y < object.y + object.height

const clientHasPlayer = client => clients.has(client) && players.has(clients.get(client).id)

const getDistance = (a, b) => Math.abs( a.x - b.x ) + Math.abs( a.y - b.y )

const addVector = a => b => ({x: a.x + b.x, y: a.y + b.y})
const addNumber = a => b => a + b

const isEmptyPosition = position => {
    for (let object of objects.values()) {
        if ( objectIncludes(object, position) ) return false
    }

    for (let player of players.values()) {
        if ( player.position.x == position.x && player.position.y == position.y ) return false
    }

    return true
}

const spawnPlayer = () => {
    //  get a postion in the spawn box
    let position = { x: random(1, 5), y: random(1, 5) }

    // make sure the postion is clear, if not regenerate it
    while ( !isEmptyPosition(position) )
        position = { x: random(1, 5), y: random(1, 5) }

    // make the player
    let player = {
        id: uuid(),
        hp: 100, mp: 100,
        position: { ...position },
        target: { ...position }
    }

    // add the new player to the list of players
    players.set(player.id, player)

    // tell all the cients that a new player has connected
    emit("playerJoin", player)

    // return the new player
    return player
}

const addClient = client => {
    // tell the new client of all the objects in the world
    for (let object of objects.values()) client("newObject", object)

    // tell the new client of all the players in the server
    for (let outher of players.values()) client("playerJoin", outher)
}

const removePlayer = player => {
    // tell the gang that the player left
    emit("playerLeft", player.id)

    // remove the player from the list of players
    players.delete(player.id)
}

const removeClient = client => {
    // remove the player that the client is controlling
    if ( clientHasPlayer(client) ) removePlayer( clients.get(client) )

    // remove the client from are list of active clients
    clients.delete(client)
}

const minTime = 500
const maxTime = 1000

const getPlayersMoves = () => new Promise(done => {
    let moves = new Map()

    let numSent = emit.to(clientHasPlayer, "turn", on => [
        on( barter.leave, client => {
            // delete the move from the set
            moves.delete(client)

            // welp, one less response we need to wait for
            numSent -= 1

            // there are no more connected players, so were done
            if (numSent == 0) done(moves)
        } ),

        on( barter.response, (client, move) => {
            // bind the move to the client
            moves.set( clients.get(client), move )
            
            // everyone has responded, were done here
            if (moves.size == numSent) done(moves)
        } )
    ]).length

    // the maxiumum amount of time people have to respond
    wait(maxTime).then(() => done(moves))
})

// list of aspects that agents can have
const hp = Symbol("aspect#hp")
const position = Symbol("aspect#position")

const applyAction = (action, source) => {
    // is were being told to just chill for a turn
    if ( action.type == "wait" ) return

    // if were moving then just dirently apply it
    if ( action.type == "move" ) return applyEffect({ type: "position", ...action }, source)

    // make sure the action exist
    if ( actions.has(action.type) ) {
        // get the player were targeting
        let target = players.get(action.target)

        // we have no valid target, let bail
        if ( target == undefined ) return console.error(`unknown target ${action.target}`)

        // make sure the target is out of range
        if ( getDistance( source.position, target.position ) > actions.get(action.type).range ) return

        // apply the damage effect
        applyEffect({ type: "hp", value: -actions.get(action.type).value }, target)
    }

    console.error(`unknown action ${action.type}`)
}

const getEffect = aspect => effects.has(aspect) ? effects.get(aspect) : new Map()

const setEffect = (aspect, target, callback) => {
    // we dont have the effects map of this aspect yet, lets add it
    if ( !effects.has(aspect) ) effects.set(aspect, new Map())

    // get the effects map for this aspect
    let effect = effects.get(aspect)

    // get the previus effect for this 
    let previous = effect.has(target) ? effect.get(target) : target[aspect]

    // and finally set it to the new value
    effect.set( target, callback( previous ) )
}

const applyEffect = (effect, target) => {
    if (effect.type == position) setEffect("position", target, addVector(effect))

    if (effect.type == hp) setEffect("hp", target, addNumber(effect.value))
}

const filterEffect = (aspect, callback) => {
    if ( !effects.has(aspect) ) return

    let effect = effects.get(aspect)

    for ( let [player, value] of effect ) {
        if ( !callback(player, aspect) ) effect.delete( player )
    }
}

const processEffect = (aspect, callback) => {
    if ( effects.has(aspect) ) effects.get(aspect).forEach(callback)
}

const tick = async () => {
    // ask the players what they want to do
    let delay = wait(minTime)
    let moves = await getPlayersMoves()
    await delay
    
    // clear the list of effects so that we can repopulate it
    effects.clear()

    // apply the actions
    moves.forEach(applyAction)

    // look at the change in everyones hp
    processEffect("hp", (player, hp) => {
        // set are hp to the new hp
        player.hp = hp

        // were out of health, and therefore dead
        if (player.hp <= 0) removePlayer(player)
    })

    filterEffect("position", ({x, y}, player) => {
        // if were not moving, then were done here 
        if (player.position.x == x && player.position.y == y) return false

        // make sure the new position dosent overlap with any objects
        for (let object of objects.values()) if ( objectIncludes(object, player.target) ) return false

        // make sure the player is only moving to an adjacent square
        if ( Math.abs( player.position.x - x ) > 1 || Math.abs( player.position.y - y ) > 1 ) return false

        // we want to keep this one
        return true
    })

    let targetPosition = getEffect("position")

    // figure out if the requested movement is allowed
    processEffect("position", (target, player) => {
        
    })

    processEffect("position", (target, player) => {
        // update the players positions
        player.position.x = target.x
        player.position.y = target.y
    })

    // tell the world news of the players changes
    players.forEach(player => emit("update", player))
}

const play = async () => {
    while (true) await tick()
}

// maps to keep track of all the users and outher stuff
const clients = new Map()
const players = new Map()
const actions = new Map()
const objects = new Map()
const effects = new Map()

objects.set(0, { id: 0, x: 6, y: 0, width: 1, height: 10 })
actions.set(0, { id: 0, name: "slice", range: 1, value: 25 })
actions.set(1, { id: 1, name: "punch", range: 1, value: 10 })

// set up express app
const app = express()
app.use(express.static('client'))

// create the http server
const server = http.createServer(app)

// create the websocket server
const emit = barter(server, on => [
    // deal with users leaving and joining
    on(barter.join, addClient),
    on(barter.leave, removeClient),
    
    // a users asked us to spawn an player for them
    on("spawn", (client, reportId) => {
        // if the client all ready has a player then remove that one first
        if ( clients.has(client) ) removeClient(client)
        
        // spawn us a new player
        let player = spawnPlayer()

        // bind the player to the client
        clients.set(client, player)

        // tell the client their id
        reportId(player.id)
    })
])

// listen in on our fav port
server.listen(4242)

// run the main game logic
play()