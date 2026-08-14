import { Target, Users, TrendingUp, ShieldCheck } from 'lucide-react';
import ChooseImage from '../../assets/images/Hero/choose_img.png';
import { CARD, CONTAINER, HEADING, ICON_PLATE, SECTION, SUBHEADING } from '../../theme/brand';

const FEATURES = [
  {
    title: 'Presisjon',
    description:
      'Smart matching sørger for at du ser de oppdragene som faktisk passer ferdighetene dine.',
    icon: Target,
  },
  {
    title: 'Fellesskap',
    description: 'Bli en del av et voksende nettverk av dyktige fagfolk og bedrifter.',
    icon: Users,
  },
  {
    title: 'Vekst',
    description: 'Bygg erfaringen din med varierte oppdrag som utfordrer og inspirerer.',
    icon: TrendingUp,
  },
  {
    title: 'Trygghet',
    description:
      'Betalingen holdes hos SafePay og frigis først når oppdragsgiver har godkjent jobben.',
    icon: ShieldCheck,
  },
];

export function Guide() {
  return (
    <section className={`${CONTAINER} ${SECTION}`}>
      <div className="mb-9 max-w-136">
        <h2 className={HEADING}>
          Hvorfor velge <span className="text-[#2E6641]">Jobblo</span>?
        </h2>
        <p className={`mt-3 ${SUBHEADING}`}>Vi gjør det enkelt, trygt og lønnsomt.</p>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-10">
        {/* The old version overlaid this image with a "250+ Jobber per dag" badge that
            nothing measured — the same fabricated-stat problem as the hero's 4.8 ★. It is
            gone rather than replaced; the real counts are in the hero and come from the API. */}
        <div className="overflow-hidden rounded-[24px] bg-[#F4F6F0]">
          <img
            src={ChooseImage}
            alt=""
            className="h-full min-h-72 w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="flex flex-col gap-3">
          {FEATURES.map(({ title, description, icon: Icon }) => (
            <div key={title} className={`${CARD} flex flex-1 items-start gap-3.5 p-4`}>
              <span className={ICON_PLATE} aria-hidden="true">
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <div>
                <h3 className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{title}</h3>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
