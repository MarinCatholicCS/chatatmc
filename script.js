//const answer = prompt("What his name is?");

function checkAcess() {
    let answer = document.getElementById("inputer").innerHTML;

    if (answer && answer.toLowerCase() === "adib") {
        document.getElementById("content").style.display = "block";
        document.getElementById("MoAdib").style.display = "none";
    } else {
        document.body.innerHTML = "<h1>Access Denied</h1>";
    }
}