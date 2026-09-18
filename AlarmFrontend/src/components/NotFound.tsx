import { Link } from 'react-router-dom';
import { BiBuoy } from 'react-icons/bi';
import errorImage from '../assets/images/error-img.png';

const NotFound = () => {
  return (
    <div
      className="min-h-screen pt-2 bg-gray-50 bg-center bg-no-repeat bg-cover"
      style={{ backgroundImage: `url(${errorImage})` }}
    >
      <div className="container mx-auto   bg-opacity-80 rounded-lg p-8">
        <div className="text-center mb-12">
          <h1 className="text-9xl font-bold">
            4
            <BiBuoy className="inline-block animate-spin text-sky-600 text-8xl mx-2" />
            4
          </h1>
          <h4 className="uppercase text-2xl mt-4 text-gray-700">
            Sorry, page not found
          </h4>
          <div className="mt-6">
            <Link
              to="/"
              className="bg-sky-600 text-white px-6 py-2 rounded hover:bg-sky-700 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
