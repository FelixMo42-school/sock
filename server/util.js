import { players, objects } from "./database.js"

export const wait = ms => new Promise(done => setTimeout(done, ms))

export const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

export const inRange = (a, b, r) => ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) <= (r + 0.5) ** 2

export const objectIncludes = (object, {x, y}) => x >= object.x && x < object.x + object.width && y >= object.y && y < object.y + object.height

export const isEmptyPosition = position => {
    for (let object of objects.values()) if ( objectIncludes(object, position) ) return false

    for (let player of players.values()) if ( player.position.x == position.x && player.position.y == position.y ) return false

    return true
}