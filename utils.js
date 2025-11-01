function coordinateToPolygon(lng, lat){
    //assert: passed values are numbers
    let coords = [[lng-0.0005, lat+0.0005],[lng+0.0005, lat+0.0005],[lng+0.0005, lat-0.0005],[lng-0.0005, lat-0.0005]]


    return coords
}