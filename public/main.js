const update = document.querySelector('#update-button');
const deleteBtn = document.querySelector('#delete-button');
const deleteMsg = document.querySelector('#message');

update.addEventListener('click', _ => {
    fetch('/quotes', {
        method: 'put',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Michael Scott',
            quote: 'You miss every shot you dont take.'
        })
    })
    .then(result => {
        if (result.ok) return result.json()
    })
    .then(response => {
        window.location.reload(true)
    })
})

deleteBtn.addEventListener('click', _ => {
    fetch('/quotes', {
        method: 'delete',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Michael Scott'
        })
    })
    .then(result => {
        if (result.ok) return result.json()
    })
    .then(data => {
        if (data === 'No changes to remove') {
            deleteMsg.textContent = 'No changes to remove';
        } else {
            window.location.reload(true)
        }
    })
})