//Debouncer

const delaySearchInput = (function(){
	let timer = 0;
	return function(callback, ms){
		clearTimeout (timer);
		timer = setTimeout(callback, ms);
	};
})();

//Components

//Movie Browser

Vue.component('movie-browser', {
	template: `
	<div class="app-wrap">

		<div v-if="loading" class="loading"><div class="loader"></div></div>
		<modal v-if="showModal" @close="showModal = false">{{ errorMsg }}</modal>

		<div class="menu">
			<div class="menu-content-wrap">
				<h1>Movies Filmed in SF</h1>
				<input v-model="searchValue" type="text" placeholder="Search Titles, Years" @keyup="searchBy"></input>
				<label>Sort movies</label>
				<div class="filter-wrap">
					<p><input type="checkbox" value="year" @click="sortBy('release_year')">by Year</p>
					<p><input type="checkbox" value="title" @click="sortBy('title')">by Title</p>
				</div>

				<div class="more-button" @click="setParameters('loadMore')">More</div>
			</div>
		</div>
		<div class="main">
			<div class="row">

				<div v-for="movie in movies" class="col-xs-6 col-sm-4 col-md-2">

					<div class="movie">
						<div class="title-year-wrap">
							<div class="truncate title"><div>{{ movie.title }}</div></div>

							<p class="light year">{{ movie.release_year }}</p>
						</div>

						<p class="light location">Location:</p>
						<div v-if="movie.location">
							<div>
								<span>{{ movie.location[0] }}</span><span class="comma">,&nbsp;</span>
								<span>{{ movie.location[1]}}</span>
							</div>
							<a :href="'https://www.google.com/maps/?q=' + movie.location" target="_blank">
								View on map
							</a>
						</div>
						<div v-else>
							<span>Not found</span>
						</div>
					</div>

				</div>

			</div>
				<a class="more-link" @click="setParameters('loadMore')">More</a>
		</div>
	</div>
	`,
	data() {
		return {
			movies: [],
			showModal: false,
			errorMsg: null,
			loading: false,
			axiosMoviesDefault: null,
			axiosLocationDefault: null,
			offset: 0,
			currentParams: { params: { $order: ':id' } },
			searchValue: null,
			sortByYear: false,
			sortByTitle: false
		}
	},
	components: 'modal',
	methods: {
		setParameters(type) {
			//Set up search parameters

			let customParams = {
				params: {}
			};

			if(type == 'initialLoad' || type == 'loadMore') { //Avoid checking for sort/search parameters if it is the initial load or we are loading the next page
				customParams = this.currentParams;
			}
			else if(this.sortByYear && this.sortByTitle) {
                customParams.params.$order = 'release_year,title';
            }
            else if(this.sortByYear) {
                customParams.params.$order = 'release_year';
            }
            else if(this.sortByTitle) {
                customParams.params.$order = 'title'; 	
            }
            else {
                customParams = { params: { $order: ':id' } }
            }

			if(this.searchValue && this.searchValue != '') { //Add a search query if one exists
				customParams.params.$select = '*';

				const searchValue = this.searchValue.trim().toLowerCase();
				const intValue = parseInt(searchValue);
				let whereClause = "lower(title) like '%" + searchValue + "%'";

				if(Number.isInteger(intValue)) {
					whereClause = whereClause + 'or release_year=' + intValue;
				}

				customParams.params.$where = whereClause;
			}

			customParams.params.$offset = this.offset;

			this.currentParams = customParams;

			this.getMovies(customParams);
		},
		getMovies(customParams) {
			this.loading = true;

			this.axiosMoviesDefault.get('', customParams)
			.then((response) => {
				if(response.data.length == 0) {
					this.errorMsg = 'No more movies found!';
					this.showModal = true;
					return [];
				}
				else {
					return response.data;
				}
			})
			.then((moviesArray) => {
				locationArray = moviesArray.map((item) => {
					if(item.locations) {
						return this.getLocation(item.locations);
					}
					else {
						return Promise.resolve(null);
					}
				});

				return Promise.all(locationArray).then((locations) => {
					return moviesWithLocation = locations.map(function(item, index) {
					  	moviesArray[index].location = item;
					  	return moviesArray[index];
					});
				});
			})
			.then((moviesWithLocation) => {
				this.movies = this.movies.concat(moviesWithLocation);
				return 'moviesLoaded';
			})
			.then((isSuccess) => {
				if(isSuccess == 'moviesLoaded') {
					this.offset += 25;
					this.loading = false;

					//Ellipsis (ellipsis can only be added once the elements have been rendered on the page)

					let titlesToTruncate = document.querySelectorAll('.truncate');

					titlesToTruncate.forEach(function(item, index) {
						let ellipsis = new Ellipsis(item);

						ellipsis.calc();
						ellipsis.set();
					});
				}
			})
			.catch((error) => {
				if(error) {
					this.handleError(error.response.status);
				}
				else {
					this.handleError('networkError');
				}
			});

		},
		getLocation(location) {
			return this.axiosLocationDefault.get('', {
				params: {
					q: location,
				}
			})
			.then((response) => {
				if(response.data[0]) {
					return [
						Math.round(response.data[0].lat * 100)/100, 
						Math.round(response.data[0].lon * 100)/100
					];
				}
				else {
					return null;
				}
			})

		},
		sortBy(type) {
			if(type == 'release_year') {
				this.sortByYear = !this.sortByYear;
			}
			if(type == 'title') {
				this.sortByTitle = !this.sortByTitle;
			}

			this.resetMovies();
			this.setParameters();
		},
		searchBy() {
			delaySearchInput(() => { 
				this.resetMovies();
				this.setParameters();
				console.log(this.searchValue) 
			}, 1000);
		},
		resetMovies() {
			this.movies = [];
			this.offset = 0;
		},
		handleError(errorType) {
				if(errorType === 404) {
					this.errorMsg = "The page you requested is unavailable!";
				}
				else if(errorType === 500) {
					this.errorMsg = "It looks like the site server is down!";
				}
				else if(errorType === 'networkError') {
					this.errorMsg = "It looks like there's been a network error.";
				}
				else {
					this.errorMsg = "Something went wrong! Please contact customer support and reference the error code: " + errorType;
				}
				this.showModal = true;
		}
	},
	mounted() {
		this.axiosMoviesDefault = axios.create({ // Sets default headers and parameters
			baseURL: 'https://data.sfgov.org/resource/wwmu-gmzc.json',
			headers: {
				'X-App-Token': '3Qmdly6kcz67ktDDK1ujlIYz7'
			},
			params: {
				$limit: 25
			}
		});

		this.axiosLocationDefault = axios.create({
			baseURL: 'https://nominatim.openstreetmap.org/search?',
			params: {
				format: 'json'
			}
		});

		this.setParameters('initialLoad');
	}
});

//Modal

Vue.component('modal', {
	template: `
		<transition name="fade-transition">
			<div class="modal-screen">
				<div class="modal">

					<slot></slot>

					<div class="modal-footer">
						<button @click="$emit('close')">ok</button>
					</div>
				</div>
			</div>
		</transition>
	`
});

new Vue({
	el: '#app'
});
