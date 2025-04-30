/* eslint-disable @next/next/no-img-element */
const Header = () => {
    return (
      <a href="/chat" className="block h-2/5 min-h-40">
        <div className="h-full flex flex-col md:flex-row relative items-center justify-center gradient-gray text-zinc-100 transition-transform duration-200 hover:scale-105 hover:cursor-pointer">
          converse com
          <img src="logo_novo_branco.png" alt="Logo" className="h-12 ml-6" />
        </div>
      </a>
    );
  };
  
  export default Header;