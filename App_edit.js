import React from 'react';
import { StyleSheet, Text, View , TextInput, ScrollView, Image, Button} from 'react-native';
// could use this instead of Image if required for future: https://www.npmjs.com/package/react-native-fast-image
import MapView, {Marker} from 'react-native-maps';
import DialogInput from 'react-native-dialog-input';
import DocumentPicker from 'react-native-document-picker';
import {Picker} from '@react-native-community/picker';
import Toast from 'react-native-simple-toast';
import Modal from 'react-native-modal';
import PushNotification from 'react-native-push-notification';
import { LocalNotification } from "./src/services/LocalPushController";
import moment from 'moment';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid } from 'react-native';
// https://github.com/react-native-community/react-native-permissions
import LocationSwitch from 'react-native-location-switch';
// https://github.com/philiWeitz/react-native-location-switch
import NetInfo from '@react-native-community/netinfo';
import Snackbar from 'react-native-snackbar';
import SplashScreen from 'react-native-splash-screen';

import { Provider } from 'react-native-paper'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import {
	StartScreen,
	LoginScreen,
	RegisterScreen,
	ResetPasswordScreen,
	Dashboard,
  } from './src/screens'
  

var RNFS = require('react-native-fs');

export default class App extends React.Component {

	interval = undefined;
	userLocationWatchPositionID = undefined;
	checkIfLocationIsNearAnySavedPinInterval = undefined;
	netInfoEventListenerUnsubscriber = undefined;

	constructor(props) {
		super(props)
		this.state = {
			region: {
		        latitude: 34.021259,
		        longitude: -118.284002,
		        latitudeDelta: 0.2,
		        longitudeDelta: 0.2,
		      },
		    savedOffers: [],
		    lastClickedLocation: {},
		    lastNearbyStoreDetailsDialogOpen: false,
		    lastNearbyStores: [],
		    userLocation: {},
		    showNotifications: true,
		    isInternetAvailable: false
		};
	}

	updateComponentState(key, value) {
		let values=this.state;
		values[key] = value;
		this.setState(values);
	}

	getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
	  var R = 6371; // Radius of the earth in km
	  var dLat = this.deg2rad(lat2-lat1);  // deg2rad below
	  var dLon = this.deg2rad(lon2-lon1); 
	  var a = 
	    Math.sin(dLat/2) * Math.sin(dLat/2) +
	    Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
	    Math.sin(dLon/2) * Math.sin(dLon/2)
	    ; 
	  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	  var d = R * c; // Distance in km
	  return d;
	}

	deg2rad(deg) {
	  return deg * (Math.PI/180)
	}

	writeToFile(path, data) {
		RNFS.writeFile(path, data, 'utf8')
			.then((success) => {
			 console.log('FILE WRITTEN!');
			})
			.catch((err) => {
			 console.log(err.message);
			});
	}

	deleteFile(path) {
		RNFS.unlink(path)
		  // spread is a method offered by bluebird to allow for more than a
		  // single return value of a promise. If you use `then`, you will receive
		  // the values inside of an array
		  .then((values) => {
		  	console.log('FILE DELETED');
		  })
		  // `unlink` will throw an error, if the item to unlink does not exist
		  .catch((err) => {
		    console.log(err.message);
		  });
	}

	getSavedOffersAndCoupons() {
		if (this.state.isInternetAvailable)
		{
			// fetch('https://parallelagile.net/hosted/free420/default/Offer',
			// fetch('https://parallelagile.net/hosted/carolineatusc/free420/Coupon/',
			
			// {
			// 	headers: {
			// 		"PaAccessToken": "4a3fa7c0-353e-4b16-833b-1782a723d1e8"
			// 	}
			// })
			// .then(response => {
			// 	if (response.status == 200)
			// 		response.json()
			// 		.then(data => this.updateComponentState("savedOffers", data))
			// 		.catch(function(error) {
			// 			console.log(error);
			// 		});
			// 	else
			// 	{
			// 		Toast.showWithGravity('Error fetching data', Toast.LONG, Toast.CENTER);
			// 		console.log(response.status);
			// 	}
			// }).catch(error => {
			// 	console.log(error.response.data);
			// });

			fetch('https://parallelagile.net/hosted/carolineatusc/free_test/CouponBlock/',	
			{
				headers: {
					"PaAccessToken": "8275d235-61e4-46c5-9a68-d42e195bb8d2"
				}
			})
			.then(response => {
				if (response.status == 200)
					response.json()
					.then(data => this.updateComponentState("savedCoupons", data))
					.catch(function(error) {
						console.log(error);
					});
				else
					Toast.showWithGravity('Error fetching data', Toast.LONG, Toast.CENTER);
			}).catch(error => {
				console.log(error.response.data);
			});
		}else
		{
			Snackbar.dismiss();
			Snackbar.show({ text: 'Uh-oh No Internet :(', duration: Snackbar.LENGTH_INDEFINITE, textColor: 'white', backgroundColor: 'red'});
		}
	}

	async requestPermissions()
	{
		try
		{
			const granted = await PermissionsAndroid.requestMultiple(
				[
					PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
					PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
					PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
				],
				{
					'title': 'LBA',
					'message': 'Please grant location and storage permissions'
				}
			);
			if (granted === PermissionsAndroid.RESULTS.GRANTED)
				console.log("Location and Storage permission granted")
			else
				console.log("Location and Storage permission denied")
		}catch (err)
		{
			console.warn(err)
		}
	}

	setLocationWatcher() {
		// https://dev-yakuza.github.io/en/react-native/react-native-maps/#track-and-display-user-location
		// https://medium.com/@arvind.chak128/how-to-auto-zoom-into-your-current-location-using-react-native-maps-88f9b3063fe7
		// https://github.com/react-native-community/react-native-geolocation
		this.userLocationWatchPositionID = Geolocation.watchPosition(
			position => {
				this.updateComponentState("userLocation", position.coords)
				this.updateComponentState("region", {
					latitude: position.coords.latitude,
			        longitude: position.coords.longitude,
			        latitudeDelta: 0.2,
			        longitudeDelta: 0.2,
			    });
			},
			error => console.log(error.code, error.message),
			{
				enableHighAccuracy: true,
				timeout: 15000,
				maximumAge: 10000,
				interval: 2000,
				distanceFilter: 5
				// 1meter distance updates (https://stackoverflow.com/questions/41415058/navigator-geolocation-watchposition-only-return-each-100-m)
				// https://reactnative.dev/docs/geolocation#watchposition
			}
		);
	}

	async componentDidMount() {
		
		SplashScreen.hide();
		
		await this.requestPermissions();

		// https://reactnativeforyou.com/how-to-check-internet-connectivity-in-react-native-android-and-ios/
		// https://medium.com/javascript-in-plain-english/check-internet-connectivity-easily-on-react-native-application-b9f0de162dd9
		// https://github.com/react-native-community/react-native-netinfo
		const netinfoResponse = await NetInfo.fetch();

		

		this.updateComponentState("isInternetAvailable", netinfoResponse.isConnected);
		
		this.netInfoEventListenerUnsubscriber = NetInfo.addEventListener(state => {
			if (state.isConnected)
			{
				if (!this.state.isInternetAvailable)
				{
					Snackbar.dismiss()
					Snackbar.show({ text: 'We are back online!', duration: Snackbar.LENGTH_LONG, textColor: 'white', backgroundColor: 'green'});
				}
			}else
				Snackbar.show({ text: 'Uh-oh No Internet :(', duration: Snackbar.LENGTH_INDEFINITE, textColor: 'white', backgroundColor: 'red'});

			this.updateComponentState("isInternetAvailable", state.isConnected);
		});

		this.interval = setInterval(() => this.getSavedOffersAndCoupons(), 4000);

		await LocationSwitch.isLocationEnabled(
	      () => {
	        this.setLocationWatcher();
	      },
	      () => {
	      	LocationSwitch.enableLocationService(1000, true,
		      () => {
		      	this.setLocationWatcher();
		      },
		      () => { console.log('Location disabled'); },
		    );
	      },
	    );

		if (await RNFS.exists(RNFS.DocumentDirectoryPath + "/processLastNearbyStores.json"))
		{
			RNFS.readFile(RNFS.DocumentDirectoryPath + "/processLastNearbyStores.json", 'ascii').then(res => {
				this.updateComponentState("lastNearbyStores", JSON.parse(res));
				this.updateComponentState("lastNearbyStoreDetailsDialogOpen", true);
				console.log(this.state.lastNearbyStores);
			})
			.catch(err => {
			    console.log(err.message);
			});
		}
		

		this.checkIfLocationIsNearAnySavedPinInterval = setInterval(() => this.checkIfLocationIsNearAnySavedPin("userLocation"), 3000);
	}

	componentWillUnmount() {
	  clearInterval(this.interval);
	  clearInterval(this.checkIfLocationIsNearAnySavedPinInterval);

	  if (this.userLocationWatchPositionID !== undefined)
	  	Geolocation.clearWatch(this.userLocationWatchPositionID);

	  if (this.netInfoEventListenerUnsubscriber !== undefined)
	  	this.netInfoEventListenerUnsubscriber();
	}

	checkIfLocationIsNearAnySavedPin(stateKeyHavingLocation) {
		let nearestPins = [];
  		for (let offer of this.state.savedOffers)
  		{
  			// https://stackoverflow.com/questions/7783684/select-coordinates-which-fall-within-a-radius-of-a-central-point
  			if ((
		          Math.acos(Math.sin(offer["latitude"] * 0.0175) * Math.sin(this.state[stateKeyHavingLocation]["latitude"] * 0.0175) 
		               + Math.cos(offer["latitude"] * 0.0175) * Math.cos(this.state[stateKeyHavingLocation]["latitude"] * 0.0175) *    
		                 Math.cos((this.state[stateKeyHavingLocation]["longitude"] * 0.0175) - (offer["longitude"] * 0.0175))
		              ) * 6371 <= offer["radius"]))
  			{
  				nearestPins.push(offer);
  			}
  		}

  		if (nearestPins.length === 0)
  		{
  			// Toast.showWithGravity('No in-range pins', Toast.LONG, Toast.CENTER);
  			this.deleteFile(RNFS.DocumentDirectoryPath + "/processLastNearbyStores.json");
  		}else if (nearestPins.length === 1)
  		{
  			this.writeToFile(RNFS.DocumentDirectoryPath + "/processLastNearbyStores.json", JSON.stringify(nearestPins));
  			if (this.state.showNotifications)
  			{
  				LocalNotification('Nearest Pin is '+nearestPins[0].store_name, 'Nearby Store Coupon', nearestPins[0])
  				this.updateComponentState("showNotifications", false);
  			}
  		}else
			{
				/* console.log(nearestPins.map(nearestPin => this.getDistanceFromLatLonInKm(nearestPin.latitude, nearestPin.longitude, this.state.lastClickedLocation.latitude, this.state.lastClickedLocation.longitude)));
				nearestPins.sort((pin1, pin2) => {
					if (this.getDistanceFromLatLonInKm(pin1.latitude, pin1.longitude, this.state.lastClickedLocation.latitude, this.state.lastClickedLocation.longitude) < this.getDistanceFromLatLonInKm(pin2.latitude, pin2.longitude, this.state.lastClickedLocation.latitude, this.state.lastClickedLocation.longitude))
						return -1

					if (this.getDistanceFromLatLonInKm(pin1.latitude, pin1.longitude, this.state.lastClickedLocation.latitude, this.state.lastClickedLocation.longitude) > this.getDistanceFromLatLonInKm(pin2.latitude, pin2.longitude, this.state.lastClickedLocation.latitude, this.state.lastClickedLocation.longitude))
						return 1

					return 0;
					});
				Toast.showWithGravity('Nearest Pin is '+nearestPins[0].title, Toast.LONG, Toast.CENTER);*/
				this.writeToFile(RNFS.DocumentDirectoryPath + "/processLastNearbyStores.json", JSON.stringify(nearestPins));
				if (this.state.showNotifications)
				{
					for(let nearestPin of nearestPins)
						LocalNotification('Nearest Pin is '+nearestPin.store_name, 'Nearby Store Coupon', nearestPin)
					this.updateComponentState("showNotifications", false);
				}
			}
	}

	render() {
		return (
		  <View style={{flex: 1, flexDirection: 'column'}}>
			    <Provider theme={theme}>
					<NavigationContainer>
						<Stack.Navigator
						initialRouteName="StartScreen"
						screenOptions={{
							headerShown: false,
						}}
						>
						<Stack.Screen name="StartScreen" component={StartScreen} />
						<Stack.Screen name="LoginScreen" component={LoginScreen} />
						<Stack.Screen name="RegisterScreen" component={RegisterScreen} />
						<Stack.Screen name="Dashboard" component={Dashboard} />
						<Stack.Screen
							name="ResetPasswordScreen"
							component={ResetPasswordScreen}
						/>
						</Stack.Navigator>
					</NavigationContainer>
    			</Provider>

		  	<Modal isVisible={this.state.lastNearbyStoreDetailsDialogOpen}>
		       	<ScrollView>
		          <View style={{
					    backgroundColor: 'white',
					    padding: 22,
					    justifyContent: 'center',
					    alignItems: 'center',
					    borderRadius: 4,
					    borderColor: 'rgba(0, 0, 0, 0.1)',
					  }}>
					<Text style={{fontWeight: 'bold', textAlign: 'center', fontSize: 20}}>Coupon Details{`\n`}</Text>
					{this.state.lastNearbyStores.length > 0 && this.state.lastNearbyStores.map(lastNearbyStore => 
					<>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_name"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_name"} style={{flex: 1}}>Store Name: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_name"+"value"} style={{flex: 1}}>{lastNearbyStore.store_name}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_address"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_address"} style={{flex: 1}}>Store Address: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_address"+"value"} style={{flex: 1}}>{lastNearbyStore.store_address}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"discount"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"discount"} style={{flex: 1}}>Discount: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"discount"+"value"} style={{flex: 1}}>{lastNearbyStore.discount}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"start_date"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"start_date"} style={{flex: 1}}>Start Date: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"start_date"+"value"} style={{flex: 1}}>{moment(new Date(lastNearbyStore.start_date)).format('DD-MMM-YYYY')}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"end_date"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"end_date"} style={{flex: 1}}>End Date: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"end_date"+"value"} style={{flex: 1}}>{moment(new Date(lastNearbyStore.end_date)).format('DD-MMM-YYYY')}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"short_description"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"short_description"} style={{flex: 1}}>Short Description: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"short_description"+"value"} style={{flex: 1}}>{lastNearbyStore.short_desc}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"long_description"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"long_description"} style={{flex: 1}}>Short Description: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"long_description"+"value"} style={{flex: 1}}>{lastNearbyStore.long_desc}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"partner_uuid"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"partner_uuid"} style={{flex: 1}}>Partner UUID: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"partner_uuid"+"value"} style={{flex: 1}}>{lastNearbyStore.partner_uuid}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"place_id"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"place_id"} style={{flex: 1}}>Place ID: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"place_id"+"value"} style={{flex: 1}}>{lastNearbyStore.place_id}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_phone"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_phone"} style={{flex: 1}}>Store Phone: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"store_phone"+"value"} style={{flex: 1}}>{lastNearbyStore.store_phone}</Text>
					</View>
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"terms"+"outer"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"terms"} style={{flex: 1}}>Terms: </Text>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"terms"+"value"} style={{flex: 1}}>{lastNearbyStore.terms}</Text>
					</View>
					<Text>{`\n`}</Text>
					{(lastNearbyStore["has_coupon"] === undefined || this.state.savedCoupons === undefined || this.state.savedCoupons.filter(savedCoupon => savedCoupon["id"] === lastNearbyStore["has_coupon"]).length === 0) && 
					<View key={lastNearbyStore.latitude+lastNearbyStore.longitude+"coupon"+"image unavailable"} style={{flex: 1, flexDirection: 'row'}}>
						<Text key={lastNearbyStore.latitude+lastNearbyStore.longitude+"no coupon image"} style={{flex: 1}}>Coupon Image Unavailable</Text>
					</View>}
					{(lastNearbyStore["has_coupon"] !== undefined && this.state.savedCoupons !== undefined && this.state.savedCoupons.filter(savedCoupon => savedCoupon["id"] === lastNearbyStore["has_coupon"]).length === 1) && 
					<Image source={{
						uri: "https://parallelagile.net/hosted/free420/default/Coupon/image_data/"+lastNearbyStore["has_coupon"],
						headers: {	"PaAccessToken": "aae1af48-ebcb-4239-b108-537e5aefa943"	}
						}}
						style={{width: '100%', height: 450, resizeMode: 'contain'}}

					/>}
					<Text>{`\n`}</Text>
					<View style={{flex: 1, flexDirection: 'row'}}>
						<Button style={{flex:1}} onPress={() => {
							this.updateComponentState("lastNearbyStoreDetailsDialogOpen", false)
						}} title="Redeem" />
						<Text style={{flex:1}}>{`\t`}</Text>
	    				<Button style={{flex:1}} onPress={() => {
	    					this.updateComponentState("lastNearbyStoreDetailsDialogOpen", false)
	    					this.deleteFile(RNFS.DocumentDirectoryPath + "/processLastNearbyStores.json");
	    				}} title="Close" />
    				</View>
    				<View style={{flexDirection: 'row'}}>
    					<Text>{`\n`}</Text>
    					<View style={{backgroundColor: '#000080', height: 11, flex: 1, alignSelf: 'center'}} />
    					<Text>{`\n`}</Text>
					</View>
					</>)}
		          </View>
		          </ScrollView>
		        </Modal>
		    
			<MapView
		   	  provider={MapView.PROVIDER_GOOGLE}
		      style={{flex: 1}}
		      onPress={(e) => {
		      	this.updateComponentState("lastClickedLocation", e.nativeEvent.coordinate);
		      	this.checkIfLocationIsNearAnySavedPin("lastClickedLocation");
		      }}
		      initialRegion={this.state.region}>

		      {this.state.savedOffers && this.state.savedOffers.map(savedOffer => 
		      	<Marker
		      		key={(savedOffer.latitude+savedOffer.longitude).toString()+"Marker"}
		        	coordinate={{latitude: Number(savedOffer.latitude), longitude: Number(savedOffer.longitude)}}
		        	title={savedOffer.store_name}
		        	description={savedOffer.discount}
		      	/>
		      )}

		      {this.state.savedOffers && this.state.savedOffers.map(savedOffer => 
		      	<MapView.Circle
		      		key={(savedOffer.latitude+savedOffer.longitude).toString()+"Circle"}
	                center = { {latitude: Number(savedOffer.latitude), longitude: Number(savedOffer.longitude) }}
	                radius = { savedOffer.radius*1000 }
	                strokeWidth = { 1 }
	                strokeColor = { '#1a66ff' }
	                fillColor = { 'rgba(230,238,255,0.5)' }
        		/>
		      )}

		      {Object.keys(this.state.lastClickedLocation).length > 0 && <Marker
		      		key={(this.state.lastClickedLocation.latitude+this.state.lastClickedLocation.longitude).toString()+"lastClickedLocation"}
		        	coordinate={{latitude: this.state.lastClickedLocation.latitude, longitude: this.state.lastClickedLocation.longitude}}
		        	pinColor="blue"
		      	/>}

		      {Object.keys(this.state.userLocation).length > 0 && <Marker
		      		key={(this.state.userLocation.latitude+this.state.userLocation.longitude).toString()+"userLocation"}
		      		coordinate={{latitude: this.state.userLocation.latitude, longitude: this.state.userLocation.longitude}}
		      		title={"Your Location"}
		      		description={"Speed: "+this.state.userLocation.speed}
		      		>
		      		<Image source={require("./blue-circle-icon.png")} style={{height:35, width: 35}} />
		      		</Marker>
		      	}
		    </MapView>
		  </View>
		);
	}
}