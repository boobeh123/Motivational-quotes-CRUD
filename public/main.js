// DOM Elements
const quotesList = document.querySelector('.quotes-list');
const messageDiv = document.getElementById('message');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const closeModal = document.querySelector('.close');

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
    const currentLikes = parseInt(likesCount.textContent);

    try {
        const response = await fetch('/addUpvote', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: quoteId,
                likes: currentLikes
            })
        });

        if (!response.ok) throw new Error('Failed to update likes');
        
        const data = await response.json();
        likesCount.textContent = data.likes;
        showMessage('Quote liked successfully!', 'success');
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to like quote', 'error');
    }
}

function handleEdit(quoteCard, quoteId) {
    const quoteText = quoteCard.querySelector('.quote-text').textContent.replace(/"/g, '');
    const quoteAuthor = quoteCard.querySelector('.quote-author').textContent.replace('- ', '');

    document.getElementById('editId').value = quoteId;
    document.getElementById('editName').value = quoteAuthor;
    document.getElementById('editQuote').value = quoteText;
    
    editModal.style.display = 'block';
}

async function handleEditSubmit(e) {
    e.preventDefault();
    
    const quoteId = document.getElementById('editId').value;
    const name = document.getElementById('editName').value;
    const quote = document.getElementById('editQuote').value;

    try {
        const response = await fetch('/editQuote', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: quoteId, name, quote })
        });

        if (!response.ok) throw new Error('Failed to update quote');
        
        const data = await response.json();
        window.location.reload();
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to update quote', 'error');
    }
}

async function handleDelete(quoteId) {
    if (!confirm('Are you sure you want to delete this quote?')) return;

    try {
        const response = await fetch('/deleteQuote', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: quoteId })
        });

        if (!response.ok) throw new Error('Failed to delete quote');
        
        const data = await response.json();
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