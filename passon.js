var form = document.getElementById("myForm");

function passOn(event){
    event.preventDefault();
    var startPoint = document.getElementById("startPoint").value;
    var dest = document.getElementById("destPoint").value;
    localStorage.setItem("startPoint", startPoint);
    localStorage.setItem("destPoint", dest);
    window.location.href = "map.html";
}