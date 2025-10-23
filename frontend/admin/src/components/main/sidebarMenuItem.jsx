import { Link } from 'react-router-dom';

const SidebarMenuItem = ({ path, name, Icon, active, disabled = false }) => {
    return (
        <Link to={path} className={`${disabled ? 'disabled-link' : ''}`}>
            <div className={active === name ? 'mainPage-sidebar-menuItem mainPage-sidebar-menuItem-active' : 'mainPage-sidebar-menuItem'}>
                <Icon style={{fill: "currentColor", width: '24px', height: '24px'}} />
                <div className='mainPage-sidebar-menuText'>{name}</div>
            </div>
        </Link>
    );
};

export default SidebarMenuItem;