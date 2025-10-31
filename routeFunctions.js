async function getAvgNumberOfCrimesForCoords(coords, addendant = 300) {
    // get waypoints every 200 meters and gets crimes for each
// result.features[0].geometry.coordinates[0] - coords array
// distance for a crime at a coordinate is approx 140 meters 

    let totalNumOfCrimes = 0
    let waypoints = [];
    let avgNumOfCrimes = null;
    let meterCounter = 0;

    for (let i = 0; i < coords.length-1; i++){
        meterCounter += (Math.sqrt(Math.pow((coords[i][0] - coords[i+1][0]), 2) + Math.pow((coords[i][1] - coords[i+1][1]), 2))) * 100000
        
        console.log("Meter counter: ", meterCounter)

        if (meterCounter >= addendant){
            meterCounter = 0

            let crimes = await getCrimesAtLocation(coords[i+1][1], coords[i+1][0])
            totalNumOfCrimes += crimes.length

            waypoints.push(coords[i+1])
        }
    }

    avgNumOfCrimes = totalNumOfCrimes/waypoints.length
    console.log("Average number of crimes along route: ", avgNumOfCrimes)
    return avgNumOfCrimes

}
