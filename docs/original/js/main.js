const message = document.querySelector(".contact p");
const emailButton = document.querySelector("#email-button");

function showEmailMessage() {
    message.textContent = "Email contact is not available yet.";
}

emailButton.addEventListener("click",showEmailMessage)