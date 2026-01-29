const answer = prompt("What his name is?");

if (answer && answer.toLowerCase() === "correctanswer") {
    document.getElementById("content").style.display = "block";
    document.getElementById("MoAdib").style.display = "none";
} else {
    document.body.innerHTML = "<h1>Access Denied</h1>";
}