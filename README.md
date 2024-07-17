# uWisp Server 
## Drop in replacement for a faster version of [Wisp Server Node](https://github.com/MercuryWorkshop/wisp-server-node)

### Changes:
- Conversion of ws uWebSockets.js
- Small optimizations

### Improvemments:
- Lower overall ping (in testing it ranged from [Wisp Server Node](https://github.com/MercuryWorkshop/wisp-server-node) having 50-60ms to the new server as low as 9-10ms but this can vary a lot depending on the server,locations,epoxy vs libcurl, etc.)
- Higher req/sec and overall scaliblity
- Faster network speeds (Close to native when using libcurl)

## Full credit for the OG wisp server node at [MercuryWorkshop Github](https://github.com/MercuryWorkshop/)

Note: Still in 'beta' and there may be some issues.
*Golang version soon mabye?*
