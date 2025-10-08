function Confirmation({ summary, onNo, onYes }) {
    return (
        <div className="modal-overlay" onClick={onNo}>
            <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
                <div>
                    {summary}
                </div>
                <div style={{marginTop: '20px', marginLeft: '20px'}}>
                    <button className='largeButton no-button' onClick={onNo}>
                        <span>No</span>
                    </button>
                    <button className='largeButton yes-button' onClick={onYes}>
                        <span>Yes</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Confirmation;