function checkAccess(event) {
    if (event.key != 'Enter') { return; }
    
    let answer = document.getElementById("inputer").value;

    if (answer && answer.toLowerCase() === "adib") {
        window.location.href = "chat/chat.html";
    } else {
        document.body.innerHTML = "<h1>Access Denied</h1>";
    }
}