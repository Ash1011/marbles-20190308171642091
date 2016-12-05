/* global new_block, randStr, bag, $, clear_blocks, document, WebSocket, escapeHtml, window */
/* global toTitleCase*/
var ws = {};
var bgcolors = ['whitebg', 'blackbg', 'redbg', 'greenbg', 'bluebg', 'purplebg', 'pinkbg', 'orangebg', 'yellowbg'];

// =================================================================================
// On Load
// =================================================================================
$(document).on('ready', function() {
	connect_to_server();
	$('input[name="name"]').val('r' + randStr(6));
	
	// =================================================================================
	// jQuery UI Events
	// =================================================================================
	$('#submit').click(function(){
		console.log('creating marble');
		var obj = 	{
						type: 'create',
						name: $('input[name="name"]').val().replace(' ', ''),
						color: $('.colorSelected').attr('color'),
						size: $('select[name="size"]').val(),
						owner: build_full_owner($('select[name="user"]').val(), bag.marble_company),
						v: 1
					};
		if(obj.owner && obj.name && obj.color){
			console.log('creating marble, sending', obj);
			ws.send(JSON.stringify(obj));
			showHomePanel();
			$('.colorValue').html('Color');											//reset
			for(var i in bgcolors) $('.createball').removeClass(bgcolors[i]);		//reset
			$('.createball').css('border', '2px dashed #fff');						//reset
		}
		return false;
	});
	
	$('#homeLink').click(function(){
		showHomePanel();
	});

	$('#createLink').click(function(){
		$('input[name="name"]').val('r' + randStr(6));
	});

	$(document).on('click', '.marblesCloseSection', function(){
		$(this).parent().fadeOut();
	});

	$(document).on('click', '.showUserPanel', function(){
		var full_owner = $(this).parent().parent().attr('owner');
		console.log('!', full_owner);
		$('.marblesWrap[owner="' + full_owner + '"]').fadeIn();
		/*$('.userPin').each(function(){
			if($(this).attr('owner') === full_owner) $(this).fadeIn();
		});*/
	});
	
	//marble color picker
	$(document).on('click', '.colorInput', function(){
		$('.colorOptionsWrap').hide();											//hide any others
		$(this).parent().find('.colorOptionsWrap').show();
	});
	$(document).on('click', '.colorOption', function(){
		var color = $(this).attr('color');
		var html = '<span class="fa fa-circle colorSelected ' + color + '" color="' + color + '"></span>';
		
		$(this).parent().parent().find('.colorValue').html(html);
		$(this).parent().hide();

		for(var i in bgcolors) $('.createball').removeClass(bgcolors[i]);			//remove prev color
		$('.createball').css('border', '0').addClass(color + 'bg');				//set new color
	});
	
	
	//drag and drop marble
	$('#user2wrap, #user1wrap, #trashbin').sortable({connectWith: '.sortable'}).disableSelection();
	/*$('#user2wrap').droppable({drop:
		function( event, ui ) {
			var user = $(ui.draggable).attr('user');
			if(user.toLowerCase() != bag.setup.USER2){
				$(ui.draggable).addClass('invalid');
				transfer_marble($(ui.draggable).attr('id'), bag.setup.USER2);
			}
		}
	});
	$('#user1wrap').droppable({drop:
		function( event, ui ) {
			var user = $(ui.draggable).attr('user');
			if(user.toLowerCase() != bag.setup.USER1){
				$(ui.draggable).addClass('invalid');
				transfer_marble($(ui.draggable).attr('id'), bag.setup.USER1);
			}
		}
	});*/
	$('#trashbin').droppable({drop:
		function( event, ui ) {
			var id = $(ui.draggable).attr('id');
			if(id){
				console.log('removing marble', id);
				var obj = 	{
								type: 'remove',
								name: id,
								v: 1
							};
				ws.send(JSON.stringify(obj));
				$(ui.draggable).fadeOut();
				setTimeout(function(){
					$(ui.draggable).remove();
				}, 300);
				showHomePanel();
			}
		}
	});
});
// =================================================================================
// Helper Fun
// ================================================================================
//show admin panel page
function showHomePanel(){
	$('#homePanel').fadeIn(300);
	$('#createPanel').hide();
	
	window.history.pushState({},'', '/home');								//put it in url so we can f5
	
	console.log('getting new marbles!!!');
	setTimeout(function(){
		$('.innerMarbleWrap').html('');										//reset the panels
		ws.send(JSON.stringify({type: 'get_marbles', v: 1}));				//need to wait a bit
		//ws.send(JSON.stringify({type: 'chainstats', v: 1}));
		//ws.send(JSON.stringify({type: 'get_owners', v: 1}));
	}, 1200);
}

//transfer_marble selected ball to user
function transfer_marble(marbleName, owner){
	if(marbleName){
		console.log('transfering marble', marbleName);
		var obj = 	{
						type: 'transfer_marble',
						name: marbleName,
						owner: owner,
						v: 1
					};
		ws.send(JSON.stringify(obj));
		showHomePanel();
	}
}


// =================================================================================
// Socket Stuff
// =================================================================================
function connect_to_server(){
	var connected = false;
	connect();
	
	function connect(){
		var wsUri = 'ws://' + document.location.hostname + ':' + document.location.port;
		console.log('Connectiong to websocket', wsUri);
		
		ws = new WebSocket(wsUri);
		ws.onopen = function(evt) { onOpen(evt); };
		ws.onclose = function(evt) { onClose(evt); };
		ws.onmessage = function(evt) { onMessage(evt); };
		ws.onerror = function(evt) { onError(evt); };
	}
	
	function onOpen(evt){
		console.log('WS CONNECTED');
		connected = true;
		clear_blocks();
		$('#errorNotificationPanel').fadeOut();
		//ws.send(JSON.stringify({type: 'get_marbles', v:1}));
		//ws.send(JSON.stringify({type: 'chainstats', v:1}));
		ws.send(JSON.stringify({type: 'get_owners', v: 1}));
	}

	function onClose(evt){
		console.log('WS DISCONNECTED', evt);
		connected = false;
		setTimeout(function(){ connect(); }, 5000);					//try again one more time, server restarts are quick
	}

	function onMessage(msg){
		try{
			var msgObj = JSON.parse(msg.data);
			if(msgObj.marble){
				console.log('rec', msgObj.msg, msgObj);
				build_ball(msgObj.marble);
			}
			else if(msgObj.msg === 'chainstats'){
				console.log('rec', msgObj.msg, ': ledger blockheight', msgObj.chainstats.height, 'block', msgObj.blockstats.height);
				//var e = formatDate(msgObj.blockstats.transactions[0].timestamp.seconds * 1000, '%M/%d/%Y &nbsp;%I:%m%P');
				//$('#blockdate').html('<span style="color:#fff">TIME</span>&nbsp;&nbsp;' + e + ' UTC');
				var temp =  {
								id: msgObj.blockstats.height, 
								blockstats: msgObj.blockstats
							};
				new_block(temp);								//send to blockchain.js
			}
			else if(msgObj.msg === 'owners'){
				console.log('rec', msgObj.msg, msgObj);
				build_user_panels(msgObj.owners);
				build_user_table_row(msgObj.owners);
				show_company_users();
				ws.send(JSON.stringify({type: 'get_marbles', v:1}));
			}
			else console.log('rec', msgObj.msg, msgObj);
		}
		catch(e){
			console.log('ERROR', e);
		}
	}

	function onError(evt){
		console.log('ERROR ', evt);
		if(!connected && bag.e == null){											//don't overwrite an error message
			$('#errorName').html('Warning');
			$('#errorNoticeText').html('Waiting on the node server to open up so we can talk to the blockchain. ');
			$('#errorNoticeText').append('This app is likely still starting up. ');
			$('#errorNoticeText').append('Check the server logs if this message does not go away in 1 minute. ');
			$('#errorNotificationPanel').fadeIn();
		}
	}
}


// =================================================================================
//	UI Building
// =================================================================================
//build a marble
function build_ball(data){
	var html = '';
	var colorClass = '';
	var size = 'fa-5x';
	
	data.name = escapeHtml(data.name);
	data.color = escapeHtml(data.color);
	data.owner = escapeHtml(data.owner);
	
	console.log('got a marble: ', data.color);
	if(!$('#' + data.name).length){								//only populate if it doesn't exists
		if(data.size == 16) size = 'fa-3x';
		if(data.color) colorClass = data.color.toLowerCase();
		
		html += '<span id="' + data.name + '" class="fa fa-circle ' + size + ' ball ' + colorClass + ' title="' + data.name + '" owner="' + data.owner + '"></span>';
		
		$('.marblesWrap').each(function(){
			var full_owner = $(this).attr('owner');
			if(data.owner.toLowerCase() === full_owner.toLowerCase()){
				$(this).find('.innerMarbleWrap').append(html);
				//$(this).append(html);
				$(this).find('.tempMsg').remove();
			}
		});
	}
	return html;
}

//build all user panels
function build_user_panels(data){
	var html = '';
	var id = '';
		
	for(var i in data){
		id = build_full_owner(data[i].username, data[i].company);
		console.log('building user', id);

		var colorClass = '';
		data[i].username = escapeHtml(data[i].username);
		data[i].company = escapeHtml(data[i].company);
		if(data[i].company.toLowerCase() === bag.marble_company.toLowerCase()) colorClass = 'adminControl';

		html += '<div id="user' + i + 'wrap" owner="' + id + '" company="' + data[i].company + '" class="marblesWrap ' + colorClass +'">';
		html +=		'<span class="fa fa-close marblesCloseSection"></span>';
		html +=		'<div class="legend">';
		html +=			 toTitleCase(data[i].username);
		html +=			'<span class="hint" style="float:right;">' + data[i].company + '</span>';
		html +=		'</div>';
		html +=		'<div class="innerMarbleWrap">&nbsp;</div>';
		html +=		'<div class="tempMsg hint" style="text-align: center;">No marbles</div>';
		html +=	'</div>';
	}
	$('#allUserPanelsWrap').html(html);

	//drag and drop marble
	$('.innerMarbleWrap').sortable({connectWith: '.innerMarbleWrap', items: 'span'}).disableSelection();
	$('.innerMarbleWrap').droppable({drop:
		function( event, ui ) {
			var dragged_user = $(ui.draggable).attr('owner').toLowerCase();
			var dropped_user = $(event.target).parent().attr('owner').toLowerCase();
			console.log('?', dragged_user, dropped_user);
			if(dragged_user != dropped_user){										//only transfer marbles that changed owners
				$(ui.draggable).addClass('invalid');
				transfer_marble($(ui.draggable).attr('id'), dropped_user);
				return true;
			}
		}
	});
}

//build all user table rows
function build_user_table_row(data){
	var html = '';
		
	for(var i in data){
		var id = build_full_owner(data[i].username, data[i].company);
		console.log('building user', id);

		var colorClass = '';
		data[i].username = escapeHtml(data[i].username);
		data[i].company = escapeHtml(data[i].company);
		if(data[i].company.toLowerCase() === bag.marble_company.toLowerCase()) colorClass = 'adminControl';

		html += '<tr owner="' + id + '" class="userRow">';
		html +=		'<td class="userPin"><span class="fa fa-thumb-tack showUserPanel"></span></td>';
		html +=		'<td class="userMarbles">0</td>';
		html +=		'<td class="userName">' + toTitleCase(data[i].username) + '</td>';
		html +=		'<td class="userCompany">' + data[i].company + '</td>';
		html +=		'<td class="userRights"><span class="fa fa-check"></span></td>';
		html +=	'</div>';
	}
	$('#userTable tbody').html(html);
}

//show users for this company
function show_company_users(){
	$('.marblesWrap').each(function(){
		var company = $(this).attr('company');
		if(bag.marble_company.toLowerCase() === company.toLowerCase()){
			$(this).fadeIn(500);									//show the users for my company
		}
	});
}

//build the correct "full owner" string - concate username and company
function build_full_owner(username, company){
	return username.toLowerCase() + '.' + company.toLowerCase();
}