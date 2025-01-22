chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed");

});

chrome.action.onClicked.addListener((tab) => {
    console.log("Extension icon clicked");
});