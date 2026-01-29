function checkAccess() {
    if (event.key != 'Enter') { return; }
    
    let answer = document.getElementById("inputer").value;

    if (answer && answer.toLowerCase() === "adib") {
        document.getElementById("hiddenContent").style.display = "block";
        document.getElementsByClassName("auth").remove();
    } else {
        document.body.innerHTML = "<h1>Access Denied</h1>";
    }
}