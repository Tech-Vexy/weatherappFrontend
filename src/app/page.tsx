'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin } from 'lucide-react';
import { WeatherForecast, WeatherService } from '../utils/weather';
import Image from 'next/image';
import './styles.css';

const Home = () => {
  const [city, setCity] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [geoLoading, setGeoLoading] = useState(false);

  // Get first day forecast (current day)
  const currentForecast = weatherData?.daily_forecasts?.[0];
  
  // Get today's hourly forecast (assuming the first entry is the current hour)
  const currentHourForecast = currentForecast?.hourly_forecasts?.[0];
  
  // Get humidity from current hour
  const humidity = currentHourForecast?.main.humidity;
  
  // Get wind from current hour
  const windSpeed = currentHourForecast?.wind.speed;
  const windDeg = currentHourForecast?.wind.deg;
  
  // Get weather data using geolocation
  const getLocationWeather = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    
    setGeoLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const data = await WeatherService.getForecastByCoords(latitude, longitude, units);
          setWeatherData(data);
          if (data.city_info?.name) {
            setCity(data.city_info.name);
          }
        } catch (error) {
          console.error('Error fetching weather by location:', error);
          
          // Provide more specific error messages based on the error type
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
            setError('Connection timed out. The weather server might be slow or unavailable. Try searching by city name instead.');
          } else {
            setError(error instanceof Error ? error.message : 'Could not get weather for your location. Please try searching by city name instead.');
          }
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setError(`Error getting location: ${err.message}`);
        setGeoLoading(false);
      },
      {
        timeout: 10000, // 10 second timeout for getting position
        maximumAge: 60000, // Accept a cached position up to 1 minute old
        enableHighAccuracy: false // Prioritize speed over accuracy
      }
    );
  }, [units]);
  
  // Refetch weather data with current parameters
  const refetchWeather = useCallback(async () => {
    setError(null);

    if (weatherData?.city_info) {
      // If we have current weather data, refresh using current location method
      if (weatherData.city_info.lat && weatherData.city_info.lon) {
        setGeoLoading(true);
        try {
          // FIXED: Use lat and lon from city_info directly
          const data = await WeatherService.getForecastByCoords(
            weatherData.city_info.lat, 
            weatherData.city_info.lon, 
            units
          );
          setWeatherData(data);
        } catch (error) {
          console.error('Error refetching weather:', error);
          setError(error instanceof Error ? error.message : 'Failed to update weather data');
        } finally {
          setGeoLoading(false);
        }
      } 
      // If we have a city name but no coordinates, use city name
      else if (city) {
        setLoading(true);
        try {
          const data = await WeatherService.getForecastByCity(city, units);
          setWeatherData(data);
        } catch (error) {
          console.error('Error refetching weather:', error);
          setError(error instanceof Error ? error.message : 'Failed to update weather data');
        } finally {
          setLoading(false);
        }
      }
    } else if (city) {
      // If we don't have weather data but have a city, search by city
      setLoading(true);
      try {
        const data = await WeatherService.getForecastByCity(city, units);
        setWeatherData(data);
      } catch (error) {
        console.error('Error refetching weather:', error);
        setError(error instanceof Error ? error.message : 'Failed to update weather data');
      } finally {
        setLoading(false);
      }
    }
  }, [city, units, weatherData?.city_info]);
  
  // Load weather data for current location when component mounts
  useEffect(() => {
    // Fetch weather for current location on initial load
    console.log('Initializing weather app - fetching current location...');
    getLocationWeather();
  }, [getLocationWeather]);
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await WeatherService.getForecastByCity(city, units);
      setWeatherData(data);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const errorResponse = (error as { response?: { data?: { error?: string } } });
        setError(errorResponse.response?.data?.error || 'Failed to fetch weather data');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to fetch weather data');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Format date function
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  // Get wind direction as cardinal point
  const getWindDirection = (deg?: number): string => {
    if (deg === undefined) return 'N/A';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(((deg % 360) / 45)) % 8];
  };

  // Get current date if no weather data is available
  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  // Get current time
  const getCurrentTime = () => {
    const date = new Date();
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  // Get weather icon URL from OpenWeatherMap
  const getWeatherIconUrl = (iconCode?: string) => {
    if (!iconCode) return '';
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  // Get default weather icon for placeholder state
  const getDefaultWeatherIcon = (condition: string = 'clear') => {
    const iconMap: Record<string, string> = {
      clear: '01d',
      clouds: '03d',
      rain: '10d'
    };
    return `https://openweathermap.org/img/wn/${iconMap[condition] || '01d'}@2x.png`;
  };
  
  return (
    <div className="max-w-5xl mx-auto my-8 p-6 border border-gray-200 rounded-lg dark-light">
      {/* Main Grid Layout */}
      <div className="grid grid-cols-4 gap-4">
        {/* Left Panel - Current Weather (D, E, F, G) */}
        <div className="card col-span-1 border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
          {/* Weather Icon */}
          <div className="flex justify-center">
            {currentForecast ? (
              <div className="text-center">
                <Image 
                  src={getWeatherIconUrl(currentForecast.weather_icon)} 
                  alt={currentForecast.weather_description} 
                  width={96}
                  height={96}
                  priority
                />
              </div>
            ) : (
              <div className="text-center">
                <Image 
                  src={getDefaultWeatherIcon()} 
                  alt="Default weather" 
                  width={96}
                  height={96}
                  priority
                />
              </div>
            )}
          </div>
          
          {/* Temperature (E) */}
          <div className="text-center mt-4 mb-1">
            <h2 className="text-3xl font-bold">
              {currentHourForecast ? `${Math.round(currentHourForecast.main.temp)}°${units === 'metric' ? 'C' : 'F'}` : '-- °C'}
            </h2>
          </div>
          
          {/* Weather Condition (F) */}
          <div className="text-center mb-6">
            <p className="text-xl">{currentForecast?.weather_description || 'Unknown'}</p>
          </div>
          
          {/* Date and Time (G) */}
          <div className="text-center mt-auto">
            <p className="text-sm">{weatherData?.city_info?.name || 'Location'}</p>
            <p className="text-sm">{currentForecast ? formatDate(currentForecast.date) : getCurrentDate()}</p>
            <p className="text-sm">{getCurrentTime()}</p>
          </div>
        </div>
        
        {/* Right Panel - Contains search and forecast */}
        <div className="card col-span-3 flex flex-col gap-4">
          {/* Search Bar Row (A, B, C) */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            {/* Search Input (A) */}
            <div className="flex-grow">
              <input 
                type="text" 
                placeholder="Enter city name..." 
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            
            {/* Search Button (B) */}
            <button 
              type="submit" 
              className="p-2"
              aria-label="Search for city"
            >
              <Search className="h-6 w-6 text-gray-500 cursor-pointer" />
            </button>
            
            {/* Current Location Button */}
            <button 
              type="button" 
              onClick={() => getLocationWeather()} 
              className="p-2"
              disabled={geoLoading}
              aria-label="Get weather for current location"
            >
              <MapPin className={`h-6 w-6 ${geoLoading ? 'text-gray-300' : 'text-gray-500'} cursor-pointer`} />
            </button>
            
            {/* Units Toggle */}
            <button 
              type="button" 
              onClick={() => {
                const newUnits = units === 'metric' ? 'imperial' : 'metric';
                setUnits(newUnits);
                setTimeout(() => refetchWeather(), 0);
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              disabled={loading || geoLoading}
              aria-label={`Switch temperature units to ${units === 'metric' ? 'Fahrenheit' : 'Celsius'}`}
            >
              {units === 'metric' ? '°C' : '°F'}
            </button>
          </form>

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md">
              {error}
            </div>
          )}
          
          {/* Loading Indicator */}
          {loading && (
            <div className="text-center py-4">
              <p>Loading weather data...</p>
            </div>
          )}

          {/* Forecast Cards Row (H) */}
          <div className="grid grid-cols-3 gap-4">
            {weatherData?.daily_forecasts ? (
              // Map through forecast data if available - starting from day 1 (tomorrow) instead of day 0 (today)
              weatherData.daily_forecasts.slice(1, 4).map((day, index) => (
                <div key={index} className="card border border-gray-200 rounded-lg p-4">
                  <div className="text-center text-sm mb-2">
                    {index === 0 ? 'Tomorrow' : day.day_of_week}
                  </div>
                  <div className="flex justify-center">
                    <Image 
                      src={getWeatherIconUrl(day.weather_icon)}
                      alt={day.weather_description}
                      width={64}
                      height={64}
                    />
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-xs">{Math.round(day.min_temp)}-{Math.round(day.max_temp)} °{units === 'metric' ? 'C' : 'F'}</p>
                  </div>
                </div>
              ))
            ) : (
              // Default forecast cards - show next three days
              <>
                <div className="card border border-gray-200 rounded-lg p-4">
                  <div className="text-center text-sm mb-2">Tomorrow</div>
                  <div className="flex justify-center">
                    <Image 
                      src={getDefaultWeatherIcon('clouds')}
                      alt="Clouds"
                      width={64}
                      height={64}
                    />
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-xs">-- °{units === 'metric' ? 'C' : 'F'}</p>
                  </div>
                </div>
                
                <div className="card border border-gray-200 rounded-lg p-4">
                  <div className="text-center text-sm mb-2">Day After</div>
                  <div className="flex justify-center">
                    <Image 
                      src={getDefaultWeatherIcon('clear')}
                      alt="Clear"
                      width={64}
                      height={64}
                    />
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-xs">-- °{units === 'metric' ? 'C' : 'F'}</p>
                  </div>
                </div>
                
                <div className="card border border-gray-200 rounded-lg p-4">
                  <div className="text-center text-sm mb-2">In 3 Days</div>
                  <div className="flex justify-center">
                    <Image 
                      src={getDefaultWeatherIcon('rain')}
                      alt="Rain"
                      width={64}
                      height={64}
                    />
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-xs">-- °{units === 'metric' ? 'C' : 'F'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Bottom Metrics (I, J) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Wind Speed (I) */}
            <div className="card border border-gray-200 rounded-lg p-4">
              <div className="text-sm mb-4">Wind Status</div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold">
                  {windSpeed !== undefined ? `${windSpeed.toFixed(1)} ${units === 'metric' ? 'km/h' : 'mph'}` : '-- km/h'}
                </p>
                <div className="mt-2 flex items-center">
                  <div className="bg-gray-200 rounded-full p-1 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-xs">{getWindDirection(windDeg)}</span>
                </div>
              </div>
            </div>
            
            {/* Humidity (J) */}
            <div className="card border border-gray-200 rounded-lg p-4">
              <div className="text-sm mb-4">Humidity</div>
              <div className="flex items-center justify-center">
                <p className="text-2xl font-semibold">{humidity ?? '--'}%</p>
              </div>
              <div className="mt-4 bg-gray-200 rounded-full h-2 w-full">
                <div 
                  className={`humidity-progress`}
                  style={{ width: `${humidity ?? 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs">0</span>
                <span className="text-xs">50</span>
                <span className="text-xs">100</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
