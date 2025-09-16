  
  export default function Header() {
	const headerStyles: React.CSSProperties = {
	  display: "flex",
	  width: "389px",
	  height: "50px",
	  padding: "0 18px",
	  justifyContent: "space-between",
	  alignItems: "center",
	  flexShrink: 0,
	  background: "#FCF9EB",
	  boxShadow: "0 2px 2px 0 rgba(0, 0, 0, 0.25)",
	  position: "absolute",
	  left: "1px",
	  top: "36px"
	}
  
	const logoStyles: React.CSSProperties = {
	  width: "79px",
	  height: "29.217px",
	  flexShrink: 0,
	  aspectRatio: "79.00/29.22",
	  position: "relative"
	}
  
	const navigationContainerStyles: React.CSSProperties = {
	  display: "flex",
	  justifyContent: "center",
	  alignItems: "center",
	  gap: "8px",
	  position: "relative"
	}
  
	const iconButtonStyles: React.CSSProperties = {
	  display: "flex",
	  justifyContent: "center",
	  alignItems: "center",
	  position: "relative",
	  background: "transparent",
	  border: "none",
	  cursor: "pointer"
	}
  
	const dividerStyles: React.CSSProperties = {
	  display: "flex",
	  width: "1px",
	  height: "16px",
	  flexDirection: "column",
	  alignItems: "flex-start",
	  position: "relative"
	}
  
	const minSideButtonStyles: React.CSSProperties = {
	  display: "flex",
	  width: "102px",
	  height: "33px",
	  padding: "7px 6px",
	  justifyContent: "center",
	  alignItems: "center",
	  gap: "3px",
	  flexShrink: 0,
	  borderRadius: "4px",
	  background: "#FF5B24",
	  position: "relative",
	  border: "none",
	  cursor: "pointer"
	}
  
	const buttonLabelStyles: React.CSSProperties = {
	  color: "#FFF",
	  fontFamily: "Nunito, -apple-system, Roboto, Helvetica, sans-serif",
	  fontSize: "16px",
	  fontStyle: "normal",
	  fontWeight: 400,
	  lineHeight: "120%",
	  position: "relative"
	}
  
	const notificationBadgeStyles: React.CSSProperties = {
	  width: "6px",
	  height: "6px",
	  aspectRatio: "1/1",
	  position: "relative",
	  right: "0.5px",
	  top: "2px",
	  fill: "#EA1717",
	  strokeWidth: "1px",
	  stroke: "#FFF"
	}
  
	const chatBadgeStyles: React.CSSProperties = {
	  width: "6px",
	  height: "6px",
	  aspectRatio: "1/1",
	  position: "relative",
	  left: "18.5px",
	  fill: "#EA1717"
	}
  
	return (
	  <header style={headerStyles}>
		<img 
		  style={logoStyles}
		  src="https://api.builder.io/api/v1/image/assets/TEMP/47e22c6bf7792962bfc1a50b04fdbe13d0455944?width=158" 
		  alt="rJobblo logo" 
		/>
		
		<div style={navigationContainerStyles}>
		  <button style={iconButtonStyles} aria-label="Notifications">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			  <path d="M4 19V17H6V10C6 8.61667 6.41667 7.38767 7.25 6.313C8.08333 5.23834 9.16667 4.534 10.5 4.2V3.5C10.5 3.08334 10.646 2.72934 10.938 2.438C11.23 2.14667 11.584 2.00067 12 2C12.416 1.99934 12.7703 2.14534 13.063 2.438C13.3557 2.73067 13.5013 3.08467 13.5 3.5V4.2C14.8333 4.53334 15.9167 5.23767 16.75 6.313C17.5833 7.38834 18 8.61734 18 10V17H20V19H4ZM12 22C11.45 22 10.9793 21.8043 10.588 21.413C10.1967 21.0217 10.0007 20.5507 10 20H14C14 20.55 13.8043 21.021 13.413 21.413C13.0217 21.805 12.5507 22.0007 12 22ZM8 17H16V10C16 8.9 15.6083 7.95834 14.825 7.175C14.0417 6.39167 13.1 6 12 6C10.9 6 9.95833 6.39167 9.175 7.175C8.39167 7.95834 8 8.9 8 10V17Z" fill="#303030"/>
			</svg>
		  </button>
  
		  <svg width="1" height="18" viewBox="0 0 1 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={dividerStyles}>
			<path d="M0.5 1L0.5 17" stroke="#E6E6E6" strokeLinecap="round"/>
		  </svg>
  
		  <button style={iconButtonStyles} aria-label="Add">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			  <path d="M11 13V16C11 16.2833 11.096 16.521 11.288 16.713C11.48 16.905 11.7173 17.0007 12 17C12.2827 16.9993 12.5203 16.9033 12.713 16.712C12.9057 16.5207 13.0013 16.2833 13 16V13H16C16.2833 13 16.521 12.904 16.713 12.712C16.905 12.52 17.0007 12.2827 17 12C16.9993 11.7173 16.9033 11.48 16.712 11.288C16.5207 11.096 16.2833 11 16 11H13V8C13 7.71667 12.904 7.47933 12.712 7.288C12.52 7.09667 12.2827 7.00067 12 7C11.7173 6.99933 11.48 7.09533 11.288 7.288C11.096 7.48067 11 7.718 11 8V11H8C7.71667 11 7.47933 11.096 7.288 11.288C7.09667 11.48 7.00067 11.7173 7 12C6.99933 12.2827 7.09534 12.5203 7.288 12.713C7.48067 12.9057 7.718 13.0013 8 13H11ZM12 22C10.6167 22 9.31667 21.7373 8.1 21.212C6.88334 20.6867 5.825 19.9743 4.925 19.075C4.025 18.1757 3.31267 17.1173 2.788 15.9C2.26333 14.6827 2.00067 13.3827 2 12C1.99933 10.6173 2.262 9.31733 2.788 8.1C3.314 6.88267 4.02633 5.82433 4.925 4.925C5.82367 4.02567 6.882 3.31333 8.1 2.788C9.318 2.26267 10.618 2 12 2C13.382 2 14.682 2.26267 15.9 2.788C17.118 3.31333 18.1763 4.02567 19.075 4.925C19.9737 5.82433 20.6863 6.88267 21.213 8.1C21.7397 9.31733 22.002 10.6173 22 12C21.998 13.3827 21.7353 14.6827 21.212 15.9C20.6887 17.1173 19.9763 18.1757 19.075 19.075C18.1737 19.9743 17.1153 20.687 15.9 21.213C14.6847 21.739 13.3847 22.0013 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z" fill="#303030"/>
			</svg>
		  </button>
  
		  <svg width="1" height="18" viewBox="0 0 1 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={dividerStyles}>
			<path d="M0.5 1L0.5 17" stroke="#E6E6E6" strokeLinecap="round"/>
		  </svg>
  
		  <div style={{ position: "relative" }}>
			<button style={iconButtonStyles} aria-label="Messages">
			  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M6 18L3.7 20.3C3.38334 20.6167 3.02067 20.6877 2.612 20.513C2.20333 20.3383 1.99933 20.0257 2 19.575V4C2 3.45 2.196 2.97933 2.588 2.588C2.98 2.19667 3.45067 2.00067 4 2H20C20.55 2 21.021 2.196 21.413 2.588C21.805 2.98 22.0007 3.45067 22 4V16C22 16.55 21.8043 17.021 21.413 17.413C21.0217 17.805 20.5507 18.0007 20 18H6ZM5.15 16H20V4H4V17.125L5.15 16Z" fill="#303030"/>
			  </svg>
			</button>
		  </div>
  
		  <button style={minSideButtonStyles} aria-label="Min side">
			<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			  <path d="M1.5 20V17.2C1.5 16.6334 1.646 16.1127 1.938 15.638C2.23 15.1634 2.61733 14.8007 3.1 14.55C4.13333 14.0334 5.18333 13.646 6.25 13.388C7.31667 13.13 8.4 13.0007 9.5 13C10.6 12.9994 11.6833 13.1287 12.75 13.388C13.8167 13.6474 14.8667 14.0347 15.9 14.55C16.3833 14.8 16.771 15.1627 17.063 15.638C17.355 16.1134 17.5007 16.634 17.5 17.2V20H1.5ZM19.5 20V17C19.5 16.2667 19.296 15.5624 18.888 14.887C18.48 14.2117 17.9007 13.6327 17.15 13.15C18 13.25 18.8 13.421 19.55 13.663C20.3 13.905 21 14.2007 21.65 14.55C22.25 14.8834 22.7083 15.254 23.025 15.662C23.3417 16.07 23.5 16.516 23.5 17V20H19.5ZM9.5 12C8.4 12 7.45833 11.6084 6.675 10.825C5.89167 10.0417 5.5 9.10003 5.5 8.00003C5.5 6.90003 5.89167 5.95836 6.675 5.17503C7.45833 4.39169 8.4 4.00003 9.5 4.00003C10.6 4.00003 11.5417 4.39169 12.325 5.17503C13.1083 5.95836 13.5 6.90003 13.5 8.00003C13.5 9.10003 13.1083 10.0417 12.325 10.825C11.5417 11.6084 10.6 12 9.5 12ZM19.5 8.00003C19.5 9.10003 19.1083 10.0417 18.325 10.825C17.5417 11.6084 16.6 12 15.5 12C15.3167 12 15.0833 11.9794 14.8 11.938C14.5167 11.8967 14.2833 11.8507 14.1 11.8C14.55 11.2667 14.896 10.675 15.138 10.025C15.38 9.37503 15.5007 8.70003 15.5 8.00003C15.4993 7.30003 15.3787 6.62503 15.138 5.97503C14.8973 5.32503 14.5513 4.73336 14.1 4.20003C14.3333 4.11669 14.5667 4.06236 14.8 4.03703C15.0333 4.01169 15.2667 3.99936 15.5 4.00003C16.6 4.00003 17.5417 4.39169 18.325 5.17503C19.1083 5.95836 19.5 6.90003 19.5 8.00003ZM3.5 18H15.5V17.2C15.5 17.0167 15.4543 16.85 15.363 16.7C15.2717 16.55 15.1507 16.4334 15 16.35C14.1 15.9 13.1917 15.5627 12.275 15.338C11.3583 15.1134 10.4333 15.0007 9.5 15C8.56667 14.9994 7.64167 15.112 6.725 15.338C5.80833 15.564 4.9 15.9014 4 16.35C3.85 16.4334 3.729 16.55 3.637 16.7C3.545 16.85 3.49933 17.0167 3.5 17.2V18ZM9.5 10C10.05 10 10.521 9.80436 10.913 9.41303C11.305 9.02169 11.5007 8.55069 11.5 8.00003C11.4993 7.44936 11.3037 6.97869 10.913 6.58803C10.5223 6.19736 10.0513 6.00136 9.5 6.00003C8.94867 5.99869 8.478 6.19469 8.088 6.58803C7.698 6.98136 7.502 7.45203 7.5 8.00003C7.498 8.54803 7.694 9.01903 8.088 9.41303C8.482 9.80703 8.95267 10.0027 9.5 10Z" fill="white"/>
			</svg>
			<span style={buttonLabelStyles}>Min side</span>
		  </button>
		</div>
	  </header>
	)
  }
  