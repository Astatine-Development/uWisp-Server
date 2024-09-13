# uWisp Server (Do not use in prod, buggy and missing features/broken-ish)
## Drop in replacement for a faster version of [Wisp Server Node](https://github.com/MercuryWorkshop/wisp-server-node)

### Changes:
- Conversion of ws uWebSockets.js
- Small optimizations

### Improvemments:
- Lower overall ping (in testing it ranged from [Wisp Server Node](https://github.com/MercuryWorkshop/wisp-server-node) having 50-60ms to the new server as low as 9-10ms but this can vary a lot depending on the server,locations,epoxy vs libcurl, etc.)
- Higher req/sec and overall scaliblity
- Faster network speeds (Close to native when using libcurl)

### Usage:
Due to how uwebsockets.js works it isnt able to be ran the same way as the origional wisp-server-node but ive provided a [Demo](https://github.com/Astatine-Development/uWisp-Demo-Proxy) proxy that shows the backend configuration required to use it.
There are 2 main ways:
- Simple:
Simple method is shown in the demo where it is reversed proxied by the server itself and is the simple 'drag and drop' approach.

- Advanced:
For more performance you can do the advanced method, this method isnt really complicated but instead of reverse proxying it on the server itself you do it with nginx or run wisp on a different port and modify your UV configuration to use it.

## Full credit for the OG wisp server node at [MercuryWorkshop Github](https://github.com/MercuryWorkshop/)

Note: Still in 'beta' and there may be some issues.
*Golang version soon mabye?*
