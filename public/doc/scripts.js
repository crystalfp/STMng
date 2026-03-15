let areOpen = false;
const toggleDetails = () => {
	if(areOpen) {
		document.body.querySelectorAll("details")
			.forEach((e) => {e.removeAttribute("open");});
		areOpen = false;
	}
	else {
		document.body.querySelectorAll("details")
			.forEach((e) => {e.setAttribute("open", true);});
		areOpen = true;
	}
};
const openDetails = (anchor) => {
	const element = document.querySelector(anchor);
	element.setAttribute("open", true);
	element.scrollIntoView();
};
const openMain = (url) => {
	window.open(url, "_self");
};
