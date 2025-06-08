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

// Like functionality
document.querySelectorAll('.like-btn').forEach(button => {
    button.addEventListener('click', async () => {
        const quoteCard = button.closest('.quote-card');
        const id = quoteCard.dataset.id;
        const likesCount = button.querySelector('.likes-count');
        const currentLikes = parseInt(likesCount.textContent);
        
        // Get liked quotes from localStorage
        const likedQuotes = JSON.parse(localStorage.getItem('likedQuotes') || '[]');
        
        // Check if user has already liked this quote
        if (likedQuotes.includes(id)) {
            showMessage('You have already liked this quote!', 'error');
            return;
        }

        try {
            const response = await fetch('/addUpvote', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: id,
                    likes: currentLikes
                })
            });

            if (response.ok) {
                const data = await response.json();
                likesCount.textContent = data.likes;
                
                // Add quote ID to liked quotes in localStorage
                likedQuotes.push(id);
                localStorage.setItem('likedQuotes', JSON.stringify(likedQuotes));
                
                // Disable the like button
                button.disabled = true;
                button.style.opacity = '0.7';
                button.style.cursor = 'not-allowed';
                
                showMessage('Quote liked successfully!', 'success');
            } else {
                const error = await response.json();
                showMessage(error.error || 'Failed to like quote', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Failed to like quote', 'error');
        }
    });
});

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

// Function to show messages
function showMessage(message, type = 'info') {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// Generate random anonymous ID
function generateAnonymousId() {
    const animals = ['bird', 'cat', 'dog', 'fox', 'wolf', 'bear', 'lion', 'tiger', 'eagle', 'owl'];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${animal}${number}`;
}

// Get or create anonymous ID
function getAnonymousId() {
    try {
        let authorId = localStorage.getItem('anonymousId');
        if (!authorId) {
            authorId = generateAnonymousId();
            localStorage.setItem('anonymousId', authorId);
        }
        return authorId;
    } catch (error) {
        console.error('Error accessing localStorage:', error);
        // Fallback to session-based ID if localStorage fails
        return 'guest_' + Math.random().toString(36).substr(2, 9);
    }
}

// Update form submission to include authorId
document.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const authorId = getAnonymousId();
    
    fetch('/addQuotes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: formData.get('name'),
            quote: formData.get('quote'),
            authorId: authorId
        })
    })
    .then(response => {
        if (response.ok) {
            window.location.reload();
        } else {
            throw new Error('Failed to add quote');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Failed to add quote', 'error');
    });
});

// Update edit button visibility based on ownership
function updateEditButtonVisibility() {
    const authorId = getAnonymousId();
    document.querySelectorAll('.quote-card').forEach(card => {
        const editBtn = card.querySelector('.edit-btn');
        const quoteAuthorId = card.dataset.authorId;
        
        if (quoteAuthorId === authorId) {
            editBtn.style.display = 'inline-block';
        } else {
            editBtn.style.display = 'none';
        }
    });
}

// Update delete button visibility based on ownership
function updateDeleteButtonVisibility() {
    const authorId = getAnonymousId();
    document.querySelectorAll('.quote-card').forEach(card => {
        const deleteBtn = card.querySelector('.delete-btn');
        const quoteAuthorId = card.dataset.authorId;
        
        if (quoteAuthorId === authorId) {
            deleteBtn.style.display = 'inline-block';
        } else {
            deleteBtn.style.display = 'none';
        }
    });
}

// Delete functionality
document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', async () => {
        const quoteCard = button.closest('.quote-card');
        const id = quoteCard.dataset.id;
        const authorId = quoteCard.dataset.authorId;
        const currentAuthorId = getAnonymousId();

        // Check if user is the author of the quote
        if (authorId !== currentAuthorId) {
            showMessage('You can only delete your own quotes!', 'error');
            return;
        }

        if (confirm('Are you sure you want to delete this quote?')) {
            try {
                const response = await fetch('/deleteQuote', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: id
                    })
                });

                if (response.ok) {
                    quoteCard.remove();
                    showMessage('Quote deleted successfully!', 'success');
                } else {
                    const error = await response.json();
                    showMessage(error.error || 'Failed to delete quote', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Failed to delete quote', 'error');
            }
        }
    });
});

// Call both visibility functions when page loads
updateEditButtonVisibility();
updateDeleteButtonVisibility();