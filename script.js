function checkAccess(event) {
    if (event.key != 'Enter') { return; }
    
    let answer = document.getElementById("inputer").value;

    if (answer && answer.toLowerCase() === "adib") {
        document.getElementById("hiddenContent").style.display = "block";
        let auths = document.getElementsByClassName("auth");
        auths.forEach(element => {
            element.remove();
        });
    } else {
        document.body.innerHTML = "<h1>Access Denied</h1>";
    }
}