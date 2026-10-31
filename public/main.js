// Update copyright year
document.addEventListener('DOMContentLoaded', function() {
    const yearSpan = document.querySelector('footer p span');
    if (yearSpan) {
        yearSpan.innerHTML = `&copy; ${new Date().getFullYear()} Bobby Asakawa`;
    }
});
// DOM Elements
const quotesList = document.querySelector('.quotes-list');
const messageDiv = document.querySelector('#message');
const editModal = document.querySelector('#editModal');
const editForm = document.querySelector('#editForm');
const editError = document.querySelector('#editError');
const closeModal = document.querySelector('.close');

// fetch() calls send JSON and ask for JSON back, so a failure arrives as { error }
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

// Event Listeners
quotesList.addEventListener('click', handleQuoteAction);
editForm.addEventListener('submit', handleEditSubmit);
closeModal.addEventListener('click', () => editModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === editModal) {
        editModal.style.display = 'none';
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

async function handleLike(quoteCard, quoteId) {
    const likesCount = quoteCard.querySelector('.likes-count');

    try {
        // Only the id: the server adds the like to whatever the count is now
        const response = await fetch('/addUpvote', {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ id: quoteId })
        });

        if (!response.ok) {
            return showMessage(await errorMessage(response, 'Failed to like quote'), 'error');
        }

        const data = await response.json();
        likesCount.textContent = data.likes;
        showMessage('Quote liked successfully!', 'success');
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to like quote', 'error');
    }
}

function handleEdit(quoteCard, quoteId) {
    // The card's data attributes hold the quote exactly as saved, quotation marks included
    document.querySelector('#editId').value = quoteId;
    document.querySelector('#editName').value = quoteCard.dataset.name;
    document.querySelector('#editQuote').value = quoteCard.dataset.quote;
    editError.hidden = true;

    editModal.style.display = 'block';
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

function showMessage(message, type = 'info') {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
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