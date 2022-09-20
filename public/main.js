const deleteQuoteIcon = document.querySelectorAll('.fa-trash')
const upvoteQuoteIcon = document.querySelectorAll('.fa-thumbs-up')

Array.from(deleteQuoteIcon).forEach((element) => {
    element.addEventListener('click', deleteQuote);
});

Array.from(upvoteQuoteIcon).forEach((element) => {
    element.addEventListener('click', addUpvote);
});

async function deleteQuote() {
    const fullName = this.parentNode.childNodes[7].innerText;
    
    try {
        const response = await fetch('deleteQuote', {
            method: 'delete',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              'name': fullName
            })
        });
        const data = await response.json();

        console.log(data);
        window.location.reload(true);
    } catch(error) {
        console.error(error);
    }
}

async function addUpvote() {
    const fullName = this.parentNode.childNodes[7].innerText
    const quote = this.parentNode.childNodes[11].innerText
    const upVotes = Number(this.parentNode.childNodes[1].innerText)

    try {
        const response = await fetch('addUpvote', {
            method: 'put',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                'likes': upVotes,
                'name': fullName,
                'quote': quote
            })
        });
        const data = await response.json();

        console.log(data);
        window.location.reload(true);
    } catch(error) {
        console.error(error);
    }
}