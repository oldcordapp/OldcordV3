function Confirmation({ summary, onNo, onYes }) {
    return (
        <div className="modal-overlay" onClick={onNo}>
            <div className="confirmation-modal-wrapper" onClick={(e) => e.stopPropagation()}>
                <div className="confirmation-modal">
                    <div className="confirmation-modal-inner">
                        <div className="confirmation-modal-inner-summary">
                            {summary}
                        </div>
                        <div className="confirmation-modal-inner-buttons-wrapper">
                            <button className='largeButton no-button' onClick={onNo}>
                                <span>No</span>
                            </button>
                            <button className='largeButton yes-button' onClick={onYes}>
                                <span>Yes</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Confirmation;