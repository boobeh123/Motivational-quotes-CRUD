// DOM Elements
const quotesList = document.querySelector('.quotes-list');
const messageDiv = document.querySelector('#message');
const editModal = document.querySelector('#editModal');
const editForm = document.querySelector('#editForm');
const editError = document.querySelector('#editError');
const closeModal = document.querySelector('.close');
const quoteBoxes = document.querySelectorAll('.quote-box');
const inspireButton = document.querySelector('.inspire-btn');
const inspireQuote = document.querySelector('.inspire-quote');

// fetch() calls send JSON and ask for JSON back, so a failure arrives as { error }
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

// A refused quote comes back as the reply to the form post, so the address
// bar reads /addQuotes. Point it back at /: reloading /addQuotes (as saving an
// edit does) would send the refused form again, or land on "Page not found".
if (window.location.pathname === '/addQuotes') {
    history.replaceState(null, '', '/');
}

// Event Listeners
quotesList.addEventListener('click', handleQuoteAction);
editForm.addEventListener('submit', handleEditSubmit);
quoteBoxes.forEach((box) => box.addEventListener('input', () => updateCharCount(box)));
inspireButton.addEventListener('click', handleInspire);
closeModal.addEventListener('click', () => editModal.close());
// A click on the dimmed area around the dialog lands on the dialog itself.
// Close only when the press started outside the dialog's box too: a press that
// starts in a field (selecting text, say) and ends outside also counts as a
// click on the dialog. This compares positions, not elements: iPhone Safari
// says a touch on the dimmed area started on the page behind it.
let pressStart = null;
document.addEventListener('pointerdown', (e) => {
    pressStart = { x: e.clientX, y: e.clientY };
}, true);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal && pressStart &&
        isOutsideDialog(pressStart.x, pressStart.y) && isOutsideDialog(e.clientX, e.clientY)) {
        editModal.close();
    }
});

// Event Handlers
function handleQuoteAction(e) {
    const quoteCard = e.target.closest('.quote-card');
    if (!quoteCard) return;

    const quoteId = quoteCard.dataset.id;
    
    if (e.target.closest('.like-btn')) {
        handleLike(quoteCard, quoteId);
    } else if (e.target.closest('.edit-btn')) {
        handleEdit(quoteCard, quoteId);
    } else if (e.target.closest('.delete-btn')) {
        handleDelete(quoteId);
    }
}

// Likes are one per browser: pressing the button again takes the like back
async function handleLike(quoteCard, quoteId) {
    const likeButton = quoteCard.querySelector('.like-btn');
    const likesCount = quoteCard.querySelector('.likes-count');
    const wasLiked = likeButton.getAttribute('aria-pressed') === 'true';

    // Ignore presses while a request is on its way, so a quick double press
    // can't like and unlike at once. A flag, not disabled, which would take
    // keyboard focus off the button.
    if (likeButton.dataset.busy) return;
    likeButton.dataset.busy = 'true';

    try {
        // Only the id: the server keeps the count
        const response = await fetch(wasLiked ? '/removeUpvote' : '/addUpvote', {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ id: quoteId })
        });

        if (!response.ok) {
            return showMessage(await errorMessage(response, wasLiked ? 'Failed to remove like' : 'Failed to like quote'), 'error');
        }

        const data = await response.json();
        likesCount.textContent = data.likes;
        showLiked(likeButton, data.liked);
        showMessage(data.liked ? 'Quote liked successfully!' : 'Like removed', 'success');
    } catch (error) {
        console.error('Error:', error);
        showMessage(wasLiked ? 'Failed to remove like' : 'Failed to like quote', 'error');
    } finally {
        delete likeButton.dataset.busy;
    }
}

// "Inspire me": a random quote from ZenQuotes, through WisdomWell's server.
// It's only shown, with their credit, never added to the collection.
async function handleInspire() {
    if (inspireButton.dataset.busy) return;
    inspireButton.dataset.busy = 'true';

    try {
        const response = await fetch('/api/inspire', { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            return showMessage(await errorMessage(response, "Couldn't fetch a quote right now"), 'error');
        }

        const { quote, author } = await response.json();
        inspireQuote.querySelector('.inspire-text').textContent = `"${quote}"`;
        inspireQuote.querySelector('.inspire-author').textContent = `- ${author}`;
        inspireQuote.hidden = false;
    } catch (error) {
        console.error('Error:', error);
        showMessage("Couldn't fetch a quote right now", 'error');
    } finally {
        delete inspireButton.dataset.busy;
    }
}

// Shows a like button as pressed (a solid heart) or not (an outline)
function showLiked(likeButton, liked) {
    likeButton.setAttribute('aria-pressed', liked);
    likeButton.title = liked ? 'Remove your like' : 'Like this quote';
    const heart = likeButton.querySelector('.fa-heart');
    heart.classList.toggle('fas', liked);
    heart.classList.toggle('far', !liked);
}

function handleEdit(quoteCard, quoteId) {
    // The card's data attributes hold the quote exactly as saved, quotation marks included
    document.querySelector('#editId').value = quoteId;
    document.querySelector('#editName').value = quoteCard.dataset.name;
    document.querySelector('#editQuote').value = quoteCard.dataset.quote;
    updateCharCount(document.querySelector('#editQuote'));
    editError.hidden = true;

    // showModal() moves focus into the dialog (to the autofocus field), closes
    // it on Escape, and returns focus to the Edit button afterwards
    editModal.showModal();
}

// True when a point on the screen is outside the open dialog's box
function isOutsideDialog(x, y) {
    const box = editModal.getBoundingClientRect();
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

// Updates the "N of 500 characters" line a quote box points to with aria-describedby.
// It isn't a live region, so screen readers hear the count when they reach the
// box, not after every key.
function updateCharCount(box) {
    const counter = document.querySelector(`#${box.getAttribute('aria-describedby')}`);
    counter.textContent = `${box.value.length} of ${box.maxLength} characters`;
}

// Shows why a save failed inside the dialog, which stays open so the text can be fixed
function showEditError(message) {
    editError.textContent = message;
    editError.hidden = false;
}

async function handleEditSubmit(e) {
    e.preventDefault();

    const quoteId = document.querySelector('#editId').value;
    const name = document.querySelector('#editName').value;
    const quote = document.querySelector('#editQuote').value;

    try {
        const response = await fetch('/editQuote', {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ id: quoteId, name, quote })
        });

        if (!response.ok) {
            return showEditError(await errorMessage(response, 'Failed to update quote'));
        }

        window.location.reload();
    } catch (error) {
        console.error('Error:', error);
        showEditError('Failed to update quote');
    }
}

async function handleDelete(quoteId) {
    if (!confirm('Are you sure you want to delete this quote?')) return;

    try {
        const response = await fetch('/deleteQuote', {
            method: 'DELETE',
            headers: JSON_HEADERS,
            body: JSON.stringify({ id: quoteId })
        });

        if (!response.ok) {
            return showMessage(await errorMessage(response, 'Failed to delete quote'), 'error');
        }

        const quoteCard = document.querySelector(`[data-id="${quoteId}"]`);
        quoteCard.remove();
        showMessage('Quote deleted successfully!', 'success');
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to delete quote', 'error');
    }
}

let messageTimer;

function showMessage(message, type = 'info') {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    // A newer message restarts the 3 seconds instead of vanishing early. Emptying
    // the text lets screen readers announce the same message again next time.
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
    }, 3000);
}

// Reads the reason from a failed fetch(): the server answers { error: '...' }.
// The rate limiter answers in plain text, and anything unreadable gets the fallback.
async function errorMessage(response, fallback) {
    if (response.status === 429) {
        return 'Too many requests. Please try again later.';
    }
    try {
        const data = await response.json();
        return data.error || fallback;
    } catch {
        return fallback;
    }
}