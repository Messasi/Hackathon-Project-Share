async function _fetchCrimesAtLocation(lat, lng, date){
    const res = await fetch(`https://data.police.uk/api/crimes-at-location?date=${date}&lat=${lat}&lng=${lng}`)
    const data = await res.json()
    return data
}

async function getCrimesAtLocation(lat, lng, crimeTimeframeMonths = 3){
// assert: crimeTimeframe >= 1
    
    const promises = [];
    const today = new Date();
    today.setDate(1) // so that the month subtracts correctly

    //Create pop up for most amount of crimes 


    for (let i = 1; i <= crimeTimeframeMonths; i++) {
        console.log(`i = ${i}`)

        const targetDate = new Date(today);
        targetDate.setMonth(today.getMonth() - i-1);

        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        
        const dateStr = `${year}-${month}`;
        console.log(`Requesting data for: ${dateStr}`);

        promises.push(_fetchCrimesAtLocation(lat, lng, dateStr));
    }

    const results = await Promise.all(promises);
    console.log(`results = ${results}`)

    return results.flat();
}


