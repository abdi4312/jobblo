import './styles/App.css'
import './styles/Jobblo.css'
import { useState } from 'react';
import Header from './components/layout/header/Header';

export default function App() {

  return (
    <>
      <Header />
    </>
  )
}


function JobbloPage() {
  const [isMonthly, setIsMonthly] = useState(true);

  return (
    <div className="jobblo-page">
      {/* Header */}
      <div className="jobblo-header">
        <img 
          src="https://api.builder.io/api/v1/image/assets/TEMP/47e22c6bf7792962bfc1a50b04fdbe13d0455944?width=158" 
          alt="Jobblo Logo" 
          className="jobblo-logo"
        />
        <div className="jobblo-nav">
          <div className="jobblo-icon-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V17H6V10C6 8.61667 6.41667 7.38767 7.25 6.313C8.08333 5.23834 9.16667 4.534 10.5 4.2V3.5C10.5 3.08334 10.646 2.72934 10.938 2.438C11.23 2.14667 11.584 2.00067 12 2C12.416 1.99934 12.7703 2.14534 13.063 2.438C13.3557 2.73067 13.5013 3.08467 13.5 3.5V4.2C14.8333 4.53334 15.9167 5.23767 16.75 6.313C17.5833 7.38834 18 8.61734 18 10V17H20V19H4ZM12 22C11.45 22 10.9793 21.8043 10.588 21.413C10.1967 21.0217 10.0007 20.5507 10 20H14C14 20.55 13.8043 21.021 13.413 21.413C13.0217 21.805 12.5507 22.0007 12 22ZM8 17H16V10C16 8.9 15.6083 7.95834 14.825 7.175C14.0417 6.39167 13.1 6 12 6C10.9 6 9.95833 6.39167 9.175 7.175C8.39167 7.95834 8 8.9 8 10V17Z" fill="#303030"/>
            </svg>
          </div>
          <div className="jobblo-divider"></div>
          <div className="jobblo-icon-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M11 13V16C11 16.2833 11.096 16.521 11.288 16.713C11.48 16.905 11.7173 17.0007 12 17C12.2827 16.9993 12.5203 16.9033 12.713 16.712C12.9057 16.5207 13.0013 16.2833 13 16V13H16C16.2833 13 16.521 12.904 16.713 12.712C16.905 12.52 17.0007 12.2827 17 12C16.9993 11.7173 16.9033 11.48 16.712 11.288C16.5207 11.096 16.2833 11 16 11H13V8C13 7.71667 12.904 7.47933 12.712 7.288C12.52 7.09667 12.2827 7.00067 12 7C11.7173 6.99933 11.48 7.09533 11.288 7.288C11.096 7.48067 11 7.718 11 8V11H8C7.71667 11 7.47933 11.096 7.288 11.288C7.09667 11.48 7.00067 11.7173 7 12C6.99933 12.2827 7.09534 12.5203 7.288 12.713C7.48067 12.9057 7.718 13.0013 8 13H11ZM12 22C10.6167 22 9.31667 21.7373 8.1 21.212C6.88334 20.6867 5.825 19.9743 4.925 19.075C4.025 18.1757 3.31267 17.1173 2.788 15.9C2.26333 14.6827 2.00067 13.3827 2 12C1.99933 10.6173 2.262 9.31733 2.788 8.1C3.314 6.88267 4.02633 5.82433 4.925 4.925C5.82367 4.02567 6.882 3.31333 8.1 2.788C9.318 2.26267 10.618 2 12 2C13.382 2 14.682 2.26267 15.9 2.788C17.118 3.31333 18.1763 4.02567 19.075 4.925C19.9737 5.82433 20.6863 6.88267 21.213 8.1C21.7397 9.31733 22.002 10.6173 22 12C21.998 13.3827 21.7353 14.6827 21.212 15.9C20.6887 17.1173 19.9763 18.1757 19.075 19.075C18.1737 19.9743 17.1153 20.687 15.9 21.213C14.6847 21.739 13.3847 22.0013 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z" fill="#303030"/>
            </svg>
          </div>
          <div className="jobblo-divider"></div>
          <div className="jobblo-icon-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 18L3.7 20.3C3.38334 20.6167 3.02067 20.6877 2.612 20.513C2.20333 20.3383 1.99933 20.0257 2 19.575V4C2 3.45 2.196 2.97933 2.588 2.588C2.98 2.19667 3.45067 2.00067 4 2H20C20.55 2 21.021 2.196 21.413 2.588C21.805 2.98 22.0007 3.45067 22 4V16C22 16.55 21.8043 17.021 21.413 17.413C21.0217 17.805 20.5507 18.0007 20 18H6ZM5.15 16H20V4H4V17.125L5.15 16Z" fill="#303030"/>
            </svg>
            <div className="jobblo-notification-badge"></div>
          </div>
          <button className="jobblo-min-side-button">
            <svg width="25" height="24" viewBox="0 0 25 24" fill="none" className="jobblo-min-side-icon">
              <path d="M1.5 20V17.2C1.5 16.6334 1.646 16.1127 1.938 15.638C2.23 15.1634 2.61733 14.8007 3.1 14.55C4.13333 14.0334 5.18333 13.646 6.25 13.388C7.31667 13.13 8.4 13.0007 9.5 13C10.6 12.9994 11.6833 13.1287 12.75 13.388C13.8167 13.6474 14.8667 14.0347 15.9 14.55C16.3833 14.8 16.771 15.1627 17.063 15.638C17.355 16.1134 17.5007 16.634 17.5 17.2V20H1.5ZM19.5 20V17C19.5 16.2667 19.296 15.5624 18.888 14.887C18.48 14.2117 17.9007 13.6327 17.15 13.15C18 13.25 18.8 13.421 19.55 13.663C20.3 13.905 21 14.2007 21.65 14.55C22.25 14.8834 22.7083 15.254 23.025 15.662C23.3417 16.07 23.5 16.516 23.5 17V20H19.5ZM9.5 12C8.4 12 7.45833 11.6084 6.675 10.825C5.89167 10.0417 5.5 9.10003 5.5 8.00003C5.5 6.90003 5.89167 5.95836 6.675 5.17503C7.45833 4.39169 8.4 4.00003 9.5 4.00003C10.6 4.00003 11.5417 4.39169 12.325 5.17503C13.1083 5.95836 13.5 6.90003 13.5 8.00003C13.5 9.10003 13.1083 10.0417 12.325 10.825C11.5417 11.6084 10.6 12 9.5 12ZM19.5 8.00003C19.5 9.10003 19.1083 10.0417 18.325 10.825C17.5417 11.6084 16.6 12 15.5 12C15.3167 12 15.0833 11.9794 14.8 11.938C14.5167 11.8967 14.2833 11.8507 14.1 11.8C14.55 11.2667 14.896 10.675 15.138 10.025C15.38 9.37503 15.5007 8.70003 15.5 8.00003C15.4993 7.30003 15.3787 6.62503 15.138 5.97503C14.8973 5.32503 14.5513 4.73336 14.1 4.20003C14.3333 4.11669 14.5667 4.06236 14.8 4.03703C15.0333 4.01169 15.2667 3.99936 15.5 4.00003C16.6 4.00003 17.5417 4.39169 18.325 5.17503C19.1083 5.95836 19.5 6.90003 19.5 8.00003ZM3.5 18H15.5V17.2C15.5 17.0167 15.4543 16.85 15.363 16.7C15.2717 16.55 15.1507 16.4334 15 16.35C14.1 15.9 13.1917 15.5627 12.275 15.338C11.3583 15.1134 10.4333 15.0007 9.5 15C8.56667 14.9994 7.64167 15.112 6.725 15.338C5.80833 15.564 4.9 15.9014 4 16.35C3.85 16.4334 3.729 16.55 3.637 16.7C3.545 16.85 3.49933 17.0167 3.5 17.2V18ZM9.5 10C10.05 10 10.521 9.80436 10.913 9.41303C11.305 9.02169 11.5007 8.55069 11.5 8.00003C11.4993 7.44936 11.3037 6.97869 10.913 6.58803C10.5223 6.19736 10.0513 6.00136 9.5 6.00003C8.94867 5.99869 8.478 6.19469 8.088 6.58803C7.698 6.98136 7.502 7.45203 7.5 8.00003C7.498 8.54803 7.694 9.01903 8.088 9.41303C8.482 9.80703 8.95267 10.0027 9.5 10Z" fill="white"/>
            </svg>
            Min side
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="jobblo-hero">
        <div className="jobblo-hero-background"></div>
        <div className="jobblo-hero-content">
          <h1 className="jobblo-title">Jobblo AS</h1>
          <div className="jobblo-slogan-container">
            <div className="jobblo-slogan">
              <span className="jobblo-slogan-small">Små jobber. </span>
              <span className="jobblo-slogan-large">Store muligheter</span>
              <span className="jobblo-slogan-medium">!</span>
            </div>
            <div className="jobblo-description">
              Finn kvalitetssertifisert fagfolk for alle dine prosjekter : oppussing, hagearbeid og annet
              alt på et sted.
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="jobblo-search-section">
        <div className="jobblo-map-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 21L9 18.9L4.35 20.7C4.01667 20.8333 3.70833 20.796 3.425 20.588C3.14167 20.38 3 20.1007 3 19.75V5.75C3 5.53333 3.06267 5.34167 3.188 5.175C3.31333 5.00833 3.484 4.88333 3.7 4.8L9 3L15 5.1L19.65 3.3C19.9833 3.16667 20.2917 3.20433 20.575 3.413C20.8583 3.62167 21 3.90067 21 4.25V18.25C21 18.4667 20.9377 18.6583 20.813 18.825C20.6883 18.9917 20.5173 19.1167 20.3 19.2L15 21ZM14 18.55V6.85L10 5.45V17.15L14 18.55ZM16 18.55L19 17.55V5.7L16 6.85V18.55ZM5 18.3L8 17.15V5.45L5 6.45V18.3Z" fill="white"/>
          </svg>
          <div className="jobblo-map-label">Kart</div>
        </div>
        <div className="jobblo-search-bar">
          <input 
            type="text" 
            placeholder="Søk etter oppdrag" 
            className="jobblo-search-input"
          />
          <svg 
            width="19" 
            height="19" 
            viewBox="0 0 20 20" 
            fill="none" 
            className="jobblo-search-icon"
          >
            <path d="M7.95828 12.122C6.68577 12.122 5.60721 11.68 4.7226 10.7959C3.83852 9.91235 3.39648 8.83405 3.39648 7.56101C3.39648 6.28796 3.83852 5.20939 4.7226 4.32532C5.60667 3.44124 6.68524 2.99947 7.95828 3C9.23133 3.00053 10.3096 3.44257 11.1932 4.32611C12.0767 5.20966 12.5188 6.28796 12.5193 7.56101C12.5193 8.11395 12.4214 8.64912 12.2256 9.16651C12.0298 9.6839 11.7724 10.1265 11.4535 10.4942L16.1569 15.1961C16.2312 15.2704 16.271 15.3619 16.2763 15.4707C16.2811 15.5785 16.2413 15.6748 16.1569 15.7597C16.072 15.8446 15.9781 15.887 15.8752 15.887C15.7722 15.887 15.6783 15.8446 15.5934 15.7597L10.8907 11.057C10.4927 11.3961 10.035 11.6585 9.51762 11.8442C9.00023 12.0299 8.48019 12.1228 7.95749 12.1228M7.95749 11.3268C9.0135 11.3268 9.90527 10.9633 10.6328 10.2363C11.3598 9.50932 11.7233 8.61754 11.7233 7.56101C11.7233 6.50447 11.3601 5.61296 10.6336 4.88649C9.90712 4.16002 9.01562 3.79652 7.95908 3.79599C6.90254 3.79599 6.01077 4.15949 5.28377 4.88649C4.55677 5.61349 4.193 6.505 4.19247 7.56101C4.19194 8.61701 4.55544 9.50852 5.28297 10.2355C6.0105 10.9625 6.90201 11.326 7.95749 11.326" fill="black"/>
          </svg>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="jobblo-action-buttons">
        <button className="jobblo-explore-button">Utforsk Jobblo</button>
        <button className="jobblo-post-job-button">Legg ut annonse!</button>
      </div>

      {/* Orange Bar */}
      <div className="jobblo-orange-bar"></div>

      {/* Campaign Text */}
      <div className="jobblo-campaign-text">Obs! Kampanje motta tilbud :)</div>

      {/* Divider Line */}
      <div className="jobblo-divider-line"></div>

      {/* What is Jobblo Section */}
      <div className="jobblo-what-is-section">
        <div className="jobblo-what-is-content">
          <div className="jobblo-what-is-title">
            <div className="jobblo-what-is-title-text">Hva er</div>
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/38b5582872e8017a60c396f9ef20d95a9725eaf1?width=254" 
              alt="Jobblo logo" 
              className="jobblo-what-is-logo"
            />
          </div>
          <div className="jobblo-description-text">
            <span className="jobblo-description-orange">
              Jobblo er en enkel plattfrom som tillatter trygg måte å finne, avtale og betale for småjobber og håndverkstjenester i hele Norge.
            </span>
            <br /><br />
            <span className="jobblo-description-black">
              Enten det gjelder plenklipping, barnepass, maling eller flyttehjelp, gjør vi det enkelt å finne folk du kan stole på, rett i nærheten. For privatpersoner, bedrifter og alle imellom.
            </span>
          </div>
        </div>
        <div className="jobblo-image-container">
          <svg 
            width="119" 
            height="93" 
            viewBox="0 0 119 93" 
            fill="none" 
            className="jobblo-image-svg"
          >
            <g filter="url(#filter0_d_524_8448)">
              <path d="M0 43.2666C0 -1.90139 24.1703 16.2363 64.9695 16.2363C105.769 16.2363 109 -22.9249 109 22.2431C109 67.411 98.6259 84.8516 57.8268 84.8516C17.0276 84.8516 67.4156 43.2666 0 43.2666Z" fill="#F2994A" fillOpacity="0.28"/>
            </g>
            <defs>
              <filter id="filter0_d_524_8448" x="0" y="0.482422" width="119" height="92.3691" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="6" dy="4"/>
                <feGaussianBlur stdDeviation="2"/>
                <feComposite in2="hardAlpha" operator="out"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_524_8448"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_524_8448" result="shape"/>
              </filter>
            </defs>
          </svg>
          <img 
            src="https://api.builder.io/api/v1/image/assets/TEMP/625702f7f4d88924da97fe6c39ae1bee1686f7aa?width=191" 
            alt="Group 3" 
            className="jobblo-image-person"
          />
        </div>
      </div>

      {/* How It Works Section */}
      <div className="jobblo-how-it-works">
        <div className="jobblo-how-it-works-title">Slik fungerer jobblo</div>
        <button className="jobblo-learn-more-button">
          <span className="jobblo-learn-more-text">Les mer</span>
        </button>

        {/* Steps Container */}
        <div className="jobblo-steps-container">
          {/* Step 1 */}
          <div className="jobblo-step">
            <div className="jobblo-step-content">
              <svg
                width="133"
                height="133"
                viewBox="0 0 150 151"
                fill="none"
                className="jobblo-step-svg"
              >
                <circle cx="75" cy="75.8242" r="75" fill="#FCF9EB"/>
                <mask id="mask0_524_8425" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="8" y="17" width="133" height="134">
                  <circle cx="74.5" cy="84.3242" r="66.5" fill="#E6F4EA"/>
                </mask>
                <g mask="url(#mask0_524_8425)">
                  <rect x="39" y="31.8242" width="71" height="139" fill="#FCF9EB"/>
                </g>
              </svg>
              <div className="jobblo-step-title">
                Last ned jobblo
              </div>
              <div className="jobblo-step-description">
                Last ned jobblo for å
                starte eventyret!
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: '212px',
              height: '251px',
              position: 'relative',
            }}>
              <svg
                width="57"
                height="151"
                viewBox="0 0 57 151"
                fill="none"
                style={{
                  position: 'absolute',
                  left: '0px',
                  top: '0px',
                }}
              >
                <circle cx="75" cy="75.8242" r="75" fill="#FCF9EB"/>
                <mask id="mask0_524_8430" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="8" y="17" width="133" height="134">
                  <circle cx="74.5" cy="84.3242" r="66.5" fill="#E6F4EA"/>
                </mask>
                <g mask="url(#mask0_524_8430)">
                  <rect x="39" y="31.8242" width="71" height="139" fill="#FCF9EB"/>
                </g>
              </svg>
              <div style={{
                color: '#E08835',
                fontSize: '20px',
                fontWeight: '800',
                lineHeight: '120%',
                position: 'absolute',
                left: '14px',
                top: '145px',
                width: '140px',
                height: '24px',
              }}>
                Start å søk!
              </div>
              <div style={{
                color: '#FCF9EB',
                fontSize: '16px',
                fontWeight: '600',
                lineHeight: '120%',
                position: 'absolute',
                left: '14px',
                top: '175px',
                width: '198px',
                height: '76px',
              }}>
                Gjennom jobblo vil
                du få muligheten til
                å se gjennom
                tusenavis av jobbannonser!
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: '177px',
              height: '216px',
              position: 'relative',
            }}>
              <div style={{
                color: '#E08835',
                fontSize: '20px',
                fontWeight: '800',
                lineHeight: '120%',
                position: 'absolute',
                left: '0px',
                top: '145px',
                width: '177px',
                height: '24px',
                textAlign: 'center',
              }}>
                Last ned jobblo
              </div>
              <div style={{
                color: '#FCF9EB',
                fontSize: '16px',
                fontWeight: '600',
                lineHeight: '120%',
                position: 'absolute',
                left: '4px',
                top: '178px',
                width: '154px',
                height: '38px',
                textAlign: 'center',
              }}>
                Last ned jobblo for å
                starte eventyret!
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: '212px',
              height: '251px',
              position: 'relative',
            }}>
              <div style={{
                color: '#E08835',
                fontSize: '20px',
                fontWeight: '800',
                lineHeight: '120%',
                position: 'absolute',
                left: '14px',
                top: '145px',
                width: '140px',
                height: '24px',
              }}>
                Start å søk!
              </div>
              <div style={{
                color: '#FCF9EB',
                fontSize: '16px',
                fontWeight: '600',
                lineHeight: '120%',
                position: 'absolute',
                left: '14px',
                top: '175px',
                width: '198px',
                height: '76px',
              }}>
                Gjennom jobblo vil
                du få muligheten til
                å se gjennom
                tusenavis av jobbannonser!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Title */}
      <div className="jobblo-categories-title">Kategorier</div>

      {/* Category Grid */}
      <div className="jobblo-category-grid">
        {/* Hage */}
        <div className="jobblo-category-item">
          <svg width="31" height="31" viewBox="0 0 32 32" fill="none" className="jobblo-category-icon">
            <path d="M18.9815 13.7452C18.9815 13.7452 15.7088 16.3634 15.7088 19.6361M7.85422 19.6361H23.5633M9.16331 19.6361L9.83094 24.3043C10.136 26.4473 10.2891 27.5195 11.0275 28.1596C11.7658 28.7998 12.8484 28.7998 15.0149 28.7998H16.4052C18.5704 28.7998 19.6517 28.7998 20.3914 28.1583C21.1297 27.5195 21.2816 26.4473 21.5892 24.3043L22.2542 19.6361M13.1731 10.555C13.9581 9.76943 14.399 8.70434 14.399 7.5938C14.399 6.48326 13.9581 5.41816 13.1731 4.63263C10.7054 2.165 5.27662 2.65722 5.27662 2.65722C5.27662 2.65722 4.78309 8.08602 7.25073 10.5537C8.03625 11.3387 9.10135 11.7796 10.2119 11.7796C11.3224 11.7796 12.3875 11.34 13.1731 10.555ZM19.3781 13.3486C19.7113 13.6822 20.107 13.947 20.5425 14.1276C20.9781 14.3082 21.445 14.4011 21.9165 14.4011C22.388 14.4011 22.8549 14.3082 23.2904 14.1276C23.726 13.947 24.1216 13.6822 24.4548 13.3486C26.5703 11.2331 26.1475 6.58056 26.1475 6.58056C26.1475 6.58056 21.4936 6.15642 19.3795 8.27191C19.0458 8.60506 18.7811 9.00072 18.6004 9.43628C18.4198 9.87183 18.3269 10.3387 18.3269 10.8102C18.3269 11.2818 18.4198 11.7486 18.6004 12.1842C18.7811 12.6197 19.0445 13.0154 19.3781 13.3486Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.0898 11.127C13.0898 11.127 15.708 14.3997 15.708 19.636" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="jobblo-category-label">Hage</div>
        </div>

        {/* Snekk */}
        <div className="jobblo-category-item">
          <svg width="31" height="31" viewBox="0 0 32 32" fill="none" className="jobblo-category-icon">
            <path d="M10.454 1.14062C10.3832 1.14062 10.3117 1.14148 10.2411 1.14247C8.69621 1.16517 7.22606 1.45419 6.02051 1.99788C11.183 2.48492 15.6525 5.78831 13.34 9.51676C13.2162 9.71644 13.0925 9.91225 12.9699 10.1074L12.9988 10.1188C12.9415 10.2661 12.9641 10.4381 13.1426 10.7036C13.321 10.9693 13.6532 11.2694 14.0477 11.4995C14.4421 11.7297 14.8968 11.8917 15.2921 11.9425C15.6598 11.9897 15.9553 11.9392 16.1512 11.8235C16.2555 11.658 16.3608 11.4912 16.4677 11.3231C17.799 10.7934 20.0208 12.0294 20.4698 13.1161C20.552 12.2432 20.87 11.2807 21.4112 10.3432C21.8222 9.63151 22.3088 9.02285 22.8322 8.54832C21.5863 8.99486 20.9891 8.13326 20.4659 6.45048C19.9629 4.83171 18.2326 3.54399 16.8973 2.77824C14.9774 1.6786 12.6505 1.1429 10.4541 1.14069L10.454 1.14062ZM25.1218 8.62312C24.8757 8.62104 24.5525 8.71873 24.165 8.96455C23.5746 9.33905 22.9178 10.0278 22.4046 10.9167C21.8914 11.8056 21.6245 12.7187 21.5953 13.4172C21.5663 14.1158 21.7605 14.5126 22.0057 14.6541C22.2509 14.7956 22.6944 14.7659 23.2848 14.3914C23.8751 14.0169 24.5319 13.33 25.0451 12.4412C25.5583 11.5523 25.8252 10.6392 25.8543 9.9406C25.8834 9.24198 25.6891 8.84342 25.4439 8.70179C25.3827 8.66645 25.3086 8.64209 25.2234 8.63086C25.1915 8.62668 25.1569 8.62343 25.1218 8.62312ZM12.1857 11.3404C4.96536 22.5322 0.266134 25.6995 1.34534 28.4033C1.84023 29.6431 3.27627 30.6345 4.73371 30.1694C7.7614 29.2035 8.41394 24.4008 15.3554 13.1027C15.2855 13.0978 15.2158 13.0908 15.1464 13.0816C14.5625 13.0068 13.9851 12.7895 13.4704 12.4891C12.9557 12.1887 12.5006 11.8073 12.1895 11.3444C12.1885 11.3429 12.1866 11.3419 12.1857 11.3405L12.1857 11.3404ZM30.1901 15.7682L23.4132 17.145L26.562 18.098L28.4931 27.2375L29.6167 27.0015L27.6857 17.87L30.1901 15.7682ZM17.9097 16.7423L13.0006 21.6131L16.157 20.681L20.3355 24.8269L18.9164 30.0371L20.0249 30.3382L21.2713 25.757L22.7882 27.2604L23.5954 26.4474L21.6184 24.4856L22.4775 21.3253L25.6761 20.5546L18.9893 18.7904L21.3671 21.0339L20.6807 23.5556L16.9702 19.8738L17.9098 16.7424L17.9097 16.7423Z" fill="white"/>
          </svg>
          <div className="jobblo-category-label">Snekk</div>
        </div>

        {/* Vask */}
        <div className="jobblo-category-item">
          <svg width="31" height="31" viewBox="0 0 32 32" fill="none" className="jobblo-category-icon">
            <path d="M25.5276 19.6355H19.6367V17.6719H25.5276V19.6355ZM29.4549 27.4901H23.564V25.5264H29.4549V27.4901ZM27.4913 23.5628H21.6004V21.5991H27.4913V23.5628Z" fill="white"/>
            <path d="M16.6947 19.6356C16.6873 18.8073 16.4661 17.9949 16.0526 17.2771C15.6391 16.5593 15.0473 15.9604 14.3344 15.5385L21.6008 2.94471L19.9023 1.96289L12.4631 14.8502C11.5501 14.6464 10.6005 14.6746 9.70126 14.9324C8.802 15.1902 7.98171 15.6693 7.31538 16.3259C3.63946 19.8713 3.92418 28.1598 3.93793 28.5113C3.94808 28.7648 4.05598 29.0045 4.23902 29.1803C4.42206 29.356 4.66602 29.454 4.91975 29.4538H19.6382C19.8442 29.4538 20.0451 29.389 20.2123 29.2685C20.3794 29.148 20.5045 28.978 20.5696 28.7825C20.6348 28.587 20.6368 28.3759 20.5753 28.1792C20.5139 27.9825 20.3921 27.8102 20.2273 27.6865C16.7516 25.0788 16.6947 19.6886 16.6947 19.6356ZM11.7139 16.6872C12.4997 16.6959 13.252 17.0071 13.8141 17.5563C14.3763 18.1055 14.705 18.8502 14.732 19.6356C14.732 19.6729 14.734 19.8398 14.7487 20.0961L8.956 17.5198C9.33757 17.2052 9.7779 16.9695 10.2514 16.8266C10.7248 16.6836 11.222 16.6363 11.7139 16.6872ZM15.1699 27.4902C14.3851 26.6911 13.8849 25.6561 13.7463 24.5447H11.7827C11.853 25.5896 12.1794 26.6012 12.7331 27.4902H10.5505C10.1465 26.216 9.90087 24.897 9.81902 23.5629H7.85538C7.91832 24.893 8.13746 26.2112 8.50829 27.4902H5.89175C5.92218 25.6875 6.17647 21.7053 7.66197 19.0927L15.058 22.3818C15.4126 24.2271 16.1702 25.9715 17.2769 27.4902H15.1699Z" fill="white"/>
          </svg>
          <div className="jobblo-category-label">Vask</div>
        </div>

        {/* Transport */}
        <div className="jobblo-category-item">
          <svg width="31" height="31" viewBox="0 0 32 32" fill="none" className="jobblo-category-icon">
            <path d="M12.5192 11.4275L13.1934 13.8663C13.8283 16.1638 14.1451 17.3132 15.0785 17.8355C16.0118 18.3591 17.1966 18.0502 19.566 17.4349L22.0795 16.7804C24.4489 16.1651 25.6337 15.8575 26.173 14.9529C26.7123 14.047 26.3955 12.8976 25.7593 10.6002L25.0865 8.16264C24.4515 5.86387 24.1334 4.71449 23.2014 4.19216C22.2667 3.66853 21.0819 3.97747 18.7125 4.59405L16.199 5.24598C13.8296 5.86125 12.6449 6.1702 12.1068 7.07609C11.5675 7.98067 11.8843 9.13005 12.5192 11.4275Z" fill="white"/>
            <path d="M2.9809 6.86976C3.01539 6.74543 3.07405 6.62911 3.15353 6.52747C3.233 6.42582 3.33173 6.34084 3.44407 6.27737C3.55641 6.21391 3.68015 6.17321 3.80823 6.1576C3.93631 6.14199 4.06621 6.15178 4.1905 6.18641L6.41989 6.8043C7.01056 6.96512 7.54956 7.27605 7.9845 7.70685C8.41943 8.13765 8.73548 8.67367 8.90192 9.26278L11.7178 19.4554L11.9246 20.1714C12.7595 20.4791 13.463 21.0648 13.917 21.83L14.3229 21.7044L25.9345 18.6869C26.0593 18.6544 26.1893 18.6468 26.317 18.6646C26.4448 18.6823 26.5678 18.7251 26.679 18.7903C26.7902 18.8556 26.8875 18.9422 26.9653 19.045C27.0431 19.1479 27.0998 19.2651 27.1323 19.3899C27.1648 19.5147 27.1724 19.6447 27.1547 19.7724C27.1369 19.9002 27.0942 20.0232 27.0289 20.1344C26.9636 20.2456 26.8771 20.3429 26.7742 20.4207C26.6713 20.4985 26.5541 20.5552 26.4293 20.5877L14.8609 23.5934L14.4289 23.7269C14.421 25.3895 13.273 26.9106 11.5358 27.361C9.45436 27.9029 7.31399 26.7038 6.75632 24.6852C6.19865 22.6666 7.43443 20.589 9.51589 20.0484C9.61974 20.0222 9.72316 19.9995 9.82614 19.9803L7.00898 9.7851C6.93279 9.52335 6.79034 9.28569 6.59541 9.09511C6.40048 8.90454 6.15966 8.7675 5.89625 8.69725L3.66556 8.07805C3.54125 8.04369 3.42493 7.98518 3.32324 7.90585C3.22156 7.82653 3.13649 7.72795 3.07291 7.61574C3.00933 7.50353 2.96848 7.3799 2.9527 7.2519C2.93691 7.12391 2.94649 6.99405 2.9809 6.86976Z" fill="white"/>
          </svg>
          <div className="jobblo-category-label">Transport</div>
        </div>

        {/* Elektriker */}
        <div className="jobblo-category-item">
          <svg width="15" height="29" viewBox="0 0 15 30" fill="none" className="jobblo-category-icon">
            <path d="M14.7273 11.9659H7.36364V0L0 17.4886H7.36364V29.4545L14.7273 11.9659Z" fill="white"/>
          </svg>
          <div className="jobblo-category-label">Elektriker</div>
        </div>

        {/* Additional category items */}
        <div className="jobblo-category-item">
          <div className="jobblo-category-label">Hage</div>
        </div>
        <div className="jobblo-category-item">
          <div className="jobblo-category-label">Hage</div>
        </div>
        <div className="jobblo-category-item">
          <div className="jobblo-category-label">Hage</div>
        </div>
      </div>

      {/* Subscription Section */}
      <div className="jobblo-subscription-section">
        <div className="jobblo-subscription-background"></div>
        <div className="jobblo-subscription-title">
          Abonner slik at oppdragene dine blir gjort effektivt.
        </div>
        <div className="jobblo-toggle-container">
          <div className="jobblo-toggle-buttons">
            <button 
              className={`jobblo-toggle-button monthly ${isMonthly ? 'active' : 'inactive'}`}
              onClick={() => setIsMonthly(true)}
            >
              Månedlig
            </button>
            <button 
              className={`jobblo-toggle-button yearly ${!isMonthly ? 'active' : 'inactive'}`}
              onClick={() => setIsMonthly(false)}
            >
              Årlig
            </button>
          </div>
        </div>
        <div className="jobblo-subscription-card">
          <div className="jobblo-card-background"></div>
          <div className="jobblo-card-content">
            {/* Subscription card content */}
            <h3 className="jobblo-card-title">Abonnoment</h3>
            <div className="jobblo-card-features">
              Økt antall visninger for andre<br/>
              Økt antall kontakt oppretting<br/>
              Økt maks grense for inntekt
            </div>
            <button className="jobblo-card-see-prices-button">
              Se våre priser
            </button>
            <button className="jobblo-card-explore-button">
              Utforsk Jobblo
            </button>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="jobblo-testimonials-section">
        <div className="jobblo-testimonials-background">
          <div style={{
            width: '375px',
            color: '#111D15',
            fontSize: '11px',
            fontWeight: '200',
            lineHeight: '120%',
            position: 'absolute',
            left: '18px',
            top: '18px',
          }}>
            Hva andre sier om oss
          </div>
          <div style={{
            width: '352px',
            height: '0px',
            background: '#616161',
            position: 'absolute',
            left: '19px',
            top: '160px',
          }}></div>
          <div style={{
            width: '133px',
            height: '74px',
            position: 'absolute',
            left: '246px',
            top: '42px',
          }}>
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/add807a64c74b340122ef4cfeb07d55c2bccc6d5?width=248" 
              alt="Testimonial" 
              style={{
                width: '124px',
                height: '65px',
                borderRadius: '10px',
              }}
            />
          </div>
          <div style={{
            width: '139px',
            height: '74px',
            position: 'absolute',
            left: '14px',
            top: '193px',
          }}>
            <div style={{
              width: '124px',
              height: '65px',
              borderRadius: '5px',
              background: 'rgba(224, 136, 53, 0.83)',
              position: 'absolute',
              left: '0px',
              top: '9px',
            }}></div>
            <div style={{
              width: '124px',
              height: '65px',
              borderRadius: '5px',
              background: '#FCF9EB',
              position: 'absolute',
              left: '11px',
              top: '0px',
            }}></div>
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/84b864c75fbe96aa2f5f29480119d82f4c5d75bc?width=100" 
              alt="Profile" 
              style={{
                width: '50px',
                height: '54px',
                borderRadius: '7.5px',
                border: '0.75px solid #E6E6E6',
                position: 'absolute',
                left: '19px',
                top: '6px',
              }}
            />
            <div style={{
              width: '62px',
              color: '#111D15',
              fontSize: '16px',
              fontWeight: '200',
              lineHeight: '18px',
              letterSpacing: '0.16px',
              position: 'absolute',
              left: '77px',
              top: '18px',
              height: '47px',
            }}>
              Thor Bjørkeli
            </div>
          </div>
        </div>
        <div className="jobblo-testimonials-bottom"></div>
      </div>

      {/* Testimonial Quotes */}
      <div className="jobblo-testimonial-quote-1">
        Jobblo har bistått oss med å flytte kontor gjentatte ganger med dyktige arbeidere som er kvalitet sjekket
      </div>

      <div className="jobblo-testimonial-quote-2">
        Jeg har endelig fått jobb og tjener penger ved bruk av jobblo
      </div>

      {/* Footer Text */}
      <div className="jobblo-footer-text">
        Få dine prosjekter unna gjort
      </div>

      {/* Footer Image */}
      <img 
        src="https://api.builder.io/api/v1/image/assets/TEMP/301a95982ad701fa1e0ac4908cd20d869cf92a55?width=1918" 
        alt="Footer" 
        className="jobblo-footer-image"
      />
    </div>
  );
}

