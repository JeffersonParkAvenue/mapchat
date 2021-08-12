const WebSocket = require('ws');
const PORT =  process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// req is type http.IncomingMessage: https://nodejs.org/api/http.html#http_class_http_incomingmessage

// send a json to everyone
const broadcast = json => {
    for (const client of wss.clients)
        client.send(JSON.stringify(json))
}

wss.on('connection', function connection(ws, req) {
    //invoked when a WebSocket message from a client is received
    const parts = req.url.split('/')
    ws.nickname = parts[parts.length-1]

    if ([...wss.clients].some(w => w !== ws && w.nickname === ws.nickname)) {
        ws.send(JSON.stringify({ type: 'reject', status: 'zim ryan' }))
        ws.close(1000)
        return;
    }

/*

to do 'movement', just send a lot of small movement to client

when client says 'move', do not teleport it instantly. instead, store as like
    'target destination'
    and then every 50 ms or something, move all cubes
        a tiny bit closer towards their 'target destination'
          (a specific amount of lenght)

*/


    ws.currPosition   = { x: 0, y: 0, z: 0 }

    //show new user to already existing users
    broadcast({
        type: 'existance',
        username: ws.nickname,
        ...ws.currPosition
    })

    //show already exsiting users to new user
    for (const client of wss.clients) {
        if (client === ws) continue;
        ws.send(JSON.stringify({
            type: 'existance',
            username: client.nickname,
            ...client.currPosition
        }));
    }

    ws.on('message', function incoming(message) {
        message = JSON.parse(message);
        console.log('received: ', message);
        if(message.type === "move"){
            ws.targetPosition = {
                x: message.x,
                y: message.y,
                z: message.z
            }/*
            broadcast({
                type: 'move',
                username: ws.nickname,
                x: ws.x,
                y: ws.y,
                z: ws.z
            })*/
            return;
        } else if (message.type === "say") {
            broadcast({ // jim ryan
                type: 'say',
                username: ws.nickname,
                message: message.message
            })
            return;
        }
    });
    
    ws.on('close', () => {
        console.log(ws.nickname + " joined");
        //nonexistence
        broadcast({ type: 'nonexistance', username: ws.nickname })
    })
});

/*

j i m
i   i
m i j

z i m
i   i
m i z

z i m r y a n
i           a
m   zim     y
r     ryan  r
y           m
a           i
n a y r m i z

*/

// 'normalised' vector times movespeed!!! 'asam'
const tickspeed = 50  // send updates every {tickspeed} milliseconds
const movespeed = 0.2 // move 0.8 units per update

// what other functions would we need to calculate a 'noramlised' vector?

// totally n
const v3sub = (v1, v2) => ({ x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z })

const v3add = (v1, v2) => ({ x: v2.x + v1.x, y: v2.y + v1.y, z: v2.z + v1.z })

const v3dot = (v1, v2) => v1.x*v2.x + v1.y*v2.y + v1.z*v2.z

const v3mag = v => Math.sqrt(v3dot(v, v))

const v3mul_by_scalar = (v, s) => ({ x: v.x*s, y: v.y*s, z: v.z*s })

const v3div_by_scalar = (v, s) => ({ x: v.x/s, y: v.y/s, z: v.z/s })

const v3norm = v => v3div_by_scalar(v, v3mag(v))

// every ?? ms move closer to target destination asam
const tinymove = (cube) => {
    let vec = v3sub(cube.currPosition, cube.targetPosition);
    const mag = v3mag(vec)
    if (mag === 0) {
        return // should never hpapen probably
    }
    // does not let cube go farther than intended
    if (mag < movespeed) { // manually teleport
        cube.currPosition = { ...cube.targetPosition }
        cube.targetPosition = null
    } else {
        let dir = v3norm(vec);
        cube.currPosition.x += movespeed*(dir.x);
        cube.currPosition.y += movespeed*(dir.y);
        cube.currPosition.z += movespeed*(dir.z);
    }
    broadcast({ type: 'move', username: cube.nickname, ...cube.currPosition })
}

// this runs  '_ => wss.clients.forEach(tinymove)' every, tickspeed milliseconds
// big controller
const move = setInterval(_ => [...wss.clients].filter(w => w.targetPosition).forEach(tinymove), tickspeed);