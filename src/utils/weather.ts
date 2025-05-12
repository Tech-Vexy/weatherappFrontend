// services/weatherAPI.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Interface for hourly forecast data
export interface HourlyForecast {
  dt: number;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    sea_level: number;
    grnd_level: number;
    humidity: number;
    temp_kf: number;
  };
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  clouds: {
    all: number;
  };
  wind: {
    speed: number;
    deg: number;
    gust: number;
  };
  visibility: number;
  pop: number;
  rain?: {
    "3h": number;
  };
  sys: {
    pod: string;
  };
  dt_txt: string;
}

// Interface for daily forecast data
export interface DailyForecast {
  date: string;
  day_of_week: string;
  avg_temp: number;
  min_temp: number;
  max_temp: number;
  weather_condition: string;
  weather_description: string;
  weather_icon: string;
  hourly_forecasts: HourlyForecast[];
}

// Interface for city information
export interface CityInfo {
  name: string;
  country: string;
  state?: string;
  lat: number;
  lon: number;
}

// Interface for city details
export interface City {
  id: number;
  name: string;
  coord: {
    lat: number;
    lon: number;
  };
  country: string;
  population: number;
  timezone: number;
  sunrise: number;
  sunset: number;
}

// Interface for weather forecast response
export interface WeatherForecast {
  city: City;
  daily_forecasts: DailyForecast[];
  city_info: CityInfo;
}

// Interface for Nominatim API response
interface NominatimResponse {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country: string;
    country_code: string;
  };
  boundingbox: string[];
}

// Create an axios instance with default configuration
const weatherApi: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 20000, // Increased timeout to 20 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Create a separate instance for Nominatim API to avoid CORS issues
const nominatimApi: AxiosInstance = axios.create({
  baseURL: 'https://nominatim.openstreetmap.org',
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    // Adding a user agent is recommended for Nominatim API
    'User-Agent': 'WeatherApp/1.0'
  }
});

// Weather service functions
export const WeatherService = {
  // Get location information from coordinates using Nominatim
  getLocationFromCoords: async (lat: number, lon: number): Promise<CityInfo | null> => {
    try {
      const response: AxiosResponse<NominatimResponse> = await nominatimApi.get(`/reverse`, {
        params: {
          lat,
          lon,
          format: 'json',
          zoom: 10,  // Zoom level for city/town detail
          addressdetails: 1
        }
      });
      
      const data = response.data;
      
      // Extract city name from address properties (city, town, village or county as fallbacks)
      const name = data.address.city || data.address.town || data.address.village || data.address.county || 'Unknown Location';
      
      return {
        name,
        country: data.address.country,
        state: data.address.state,
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon)
      };
    } catch (error) {
      console.error('Error getting location from coordinates:', error);
      return null;
    }
  },
  
  // Get forecast by city name
  getForecastByCity: async (city: string, units: 'metric' | 'imperial' = 'metric'): Promise<WeatherForecast> => {
    try {
      const response: AxiosResponse<WeatherForecast> = await weatherApi.get(`/api/weather/forecast/city`, { 
        params: { 
          city, 
          units 
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      throw error;
    }
  },
  
  // Get forecast by coordinates
  getForecastByCoords: async (lat: number, lon: number, units: 'metric' | 'imperial' = 'metric'): Promise<WeatherForecast> => {
    try {
      // First, get location information from Nominatim
      const locationInfo = await WeatherService.getLocationFromCoords(lat, lon);
      
      // Then get weather data
      const response: AxiosResponse<WeatherForecast> = await weatherApi.get(`/api/weather/forecast/coordinates`, {
        params: {
          lat,
          lon,
          units
        }
      });
      
      const weatherData = response.data;
      
      // If we have location info from Nominatim, update the city_info in the response
      if (locationInfo) {
        weatherData.city_info = {
          ...weatherData.city_info,
          name: locationInfo.name,
          country: locationInfo.country,
          state: locationInfo.state
        };
      }
      
      return weatherData;
    } catch (error) {
      console.error('Error fetching weather forecast by coordinates:', error);
      throw error;
    }
  },
};


export default WeatherService;